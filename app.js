// Supabase Edge Function: bright-endpoint (Final Hardened Production Build)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRODUCTION_ORIGIN = "https://al-majid-ai-control-center.pages.dev";
const MAX_PAYLOAD_BYTES = 16_384; // 16 KB كحد أقصى لحجم الطلب الخام
const MAX_MESSAGE_CHARS = 2000;

// ملاحظة للإطلاق العام: عداد الذاكرة محلي مؤقت، وسيتطلب لاحقاً عداداً مركزياً في قاعدة البيانات مع تحديث ذري
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true; // طلبات غير المتصفح؛ محمية بالمصادقة

  try {
    const url = new URL(origin);

    if (url.origin === PRODUCTION_ORIGIN) return true;

    // السماح بالتطوير المحلي فقط عبر HTTP
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

// دالة قراءة الجسم تدريجياً لمنع استهلاك الذاكرة بحمولات ضخمة
async function readLimitedBody(
  req: Request,
  maxBytes: number
): Promise<string | null> {
  if (!req.body) return null;

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("PAYLOAD_TOO_LARGE");
      }

      chunks.push(value);
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      throw error;
    }

    throw new Error("INVALID_REQUEST_BODY");
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const origin = req.headers.get("Origin") || "";

  // 1. حظر النطاقات غير المصرح بها فوراً
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: "النطاق غير مسموح له." }),
      {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // 2. التعامل مع طلبات CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 3. حصر طرق الطلب المسموحة في POST فقط
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "طريقة الطلب غير مسموحة." }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. التحقق الصارم من أن الطلب يرسل JSON (Content-Type)
    const contentType = req.headers.get("Content-Type") || "";
    const mimeType = contentType.split(";")[0].trim().toLowerCase();

    if (mimeType !== "application/json") {
      return new Response(
        JSON.stringify({ error: "يجب إرسال البيانات بصيغة JSON." }),
        {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. فحص حجم الطلب المبدئي عبر Content-Length مع التحقق من صحة القيمة
    const contentLengthHeader = req.headers.get("Content-Length");

    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);

      if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
        return new Response(
          JSON.stringify({ error: "قيمة حجم الطلب غير صالحة." }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (contentLength > MAX_PAYLOAD_BYTES) {
        return new Response(
          JSON.stringify({ error: "حجم الطلب يتجاوز الحد المسموح به." }),
          {
            status: 413,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // 6. التحقق من وجود توثيق الجلسة (Authorization Header)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "مطلوب توثيق الجلسة." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. التحقق من إعدادات Supabase البيئية قبل إنشاء العميل
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration.");

      return new Response(
        JSON.stringify({ error: "الخدمة غير مهيأة حالياً." }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 8. التحقق من صحة المستخدم وجلسة الدخول
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "جلسة تسجيل الدخول غير صالحة أو منتهية الصلاحية." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 9. التحقق الأمني على مستوى الخادم: هل المستخدم مدير نشط؟
    const { data: isDirector, error: rpcError } = await supabaseClient.rpc(
      "is_active_director"
    );

    if (rpcError || isDirector !== true) {
      return new Response(
        JSON.stringify({ error: "غير مسموح لك بالوصول: صلاحية المدير النشط مطلوبة." }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 10. حماية الاستهلاك (Rate Limiting) المؤقتة
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({
          error: "تم تجاوز الحد المسموح للطلبات. يرجى الانتظار دقيقة قبل المحاولة مجدداً.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 11. قراءة نص الطلب تدريجياً بأمان تام مع منع تجاوز الحد المسموح
    let rawBody: string;
    try {
      const result = await readLimitedBody(req, MAX_PAYLOAD_BYTES);

      if (result === null) {
        return new Response(
          JSON.stringify({ error: "جسم الطلب مفقود." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      rawBody = result;
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
        return new Response(
          JSON.stringify({ error: "حجم الطلب يتجاوز الحد المسموح." }),
          {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "تعذر قراءة بيانات الطلب." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "تنسيق البيانات غير صالح (Invalid JSON)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const message =
      typeof body === "object" && body !== null && "message" in body
        ? (body as Record<string, unknown>).message
        : undefined;

    if (typeof message !== "string" || message.trim() === "") {
      return new Response(
        JSON.stringify({ error: "الرسالة مطلوبة ولا يمكن أن تكون فارغة." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return new Response(
        JSON.stringify({
          error: `الرسالة طويلة جداً. الحد الأقصى هو ${MAX_MESSAGE_CHARS} حرف.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 12. جلب مفتاح وطراز الذكاء الاصطناعي من أسرار الخادم بأمان
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    if (!openaiApiKey) {
      console.error("Configuration Error: Missing OPENAI_API_KEY secret.");
      return new Response(
        JSON.stringify({ error: "الخدمة غير مهيأة حالياً." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 13. تعليمات النظام لليلى مع تعزيز القواعد
    const systemPrompt = `أنتِ "ليلى"، مساعدة الذكاء الاصطناعي الرسمية وممثلة خدمة العملاء في "وكالة الماجد للتسويق" (AL MAJID MARKETING) في نيجيريا، المتخصصة في دعم الشركات، التجار، والأسر المنتجة.

يجب عليكِ الالتزام الصارم بالقواعد التالية في جميع ردودك:
1. اللغات المعتمدة: تتحدثين بطلاقة واحترافية باللغات الثلاث المعتمدة في الوكالة (العربية، الإنجليزية، والهوسا)، وتجيبين بنفس لغة المستخدم ما لم يُطلب منك غير ذلك.
2. سياسة الدفع المسبق وعدم الاعتماد الفوري للصور: جميع خدمات وحملات الوكالة الإعلانية والتسويقية تخضع سياسة الدفع المسبق بالكامل قبل البدء. يُمنع منعاً باتاً اعتبار صورة إيصال التحويل أو الدفع دليلاً قطعياً على التحصيل المالي حتى يتم التحقق المالي الرسمي واعتماده من الإدارة.
3. منع اختلاق الأسعار والنتائج: يحظر تماماً اختلاق أي أسعار، أو أرقام مبيعات، أو نتائج حملات، أو تفاصيل مالية غير موجودة رسمياً في سجلات الوكالة أو معتمدة بطلب صريح من المدير.
4. حماية بيانات العملاء: يُمنع منعاً باتاً مشاركة أو تسريب أي بيانات شخصية، أو أرقام هواتف، أو تفاصيل تجارية خاصة بالعملاء لأي جهة خارجية.
5. حدود الصلاحيات: يُمنع منعاً باتاً نشر أي إعلانات، أو اعتماد تصاميم، أو تعديل ميزانيات الحملات، أو تقديم خصومات أو التزامات مالية/تعاقدية دون موافقة صريحة ومسبقة من مدير الوكالة.
6. الأسلوب والهوية: حافظي على نبرة مهنية، مهذبة، واضحة، ومختصرة، وادعمي المدير في تنظيم المهام وصياغة الردود الاحترافية.`;

    // 14. الاتصال الفعلي بـ OpenAI مع مهلة 30 ثانية وتحديد الحد الأقصى للرموز (max_tokens: 800)
    const openAiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message.trim() },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!openAiResponse.ok) {
      const requestId = openAiResponse.headers.get("x-request-id") || "unknown";
      console.error(
        `OpenAI API Error - Status: ${openAiResponse.status}, Request ID: ${requestId}`
      );
      return new Response(
        JSON.stringify({
          error: "تعذر معالجة الطلب عبر خدمة الذكاء الاصطناعي حالياً.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openAiData = await openAiResponse.json();
    const replyText = openAiData.choices?.[0]?.message?.content;

    // 15. التحقق الصارم من وجود نص حقيقي في الاستجابة
    if (typeof replyText !== "string" || replyText.trim() === "") {
      console.error("OpenAI returned an empty or invalid response.");

      return new Response(
        JSON.stringify({
          error: "وصل رد غير مكتمل من خدمة الذكاء الاصطناعي. يرجى المحاولة مجدداً.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 16. إرجاع الرد للمدير بنجاح
    return new Response(
      JSON.stringify({ reply: replyText.trim() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error("OpenAI API Request Timeout (30s exceeded).");
      return new Response(
        JSON.stringify({
          error: "انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.",
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.error("Edge Function Internal Error.");
    return new Response(
      JSON.stringify({
        error: "حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});