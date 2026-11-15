import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1";

const LEILA_INSTRUCTIONS = `
أنتِ ليلى، موظفة خدمة العملاء في وكالة الماجد للتسويق.

تحدثي بأسلوب مهني وودود.
تدعمين العربية والإنجليزية والهوسا.
ساعدي المدير في صياغة الردود وخدمة العملاء.
لا تختلقي معلومات أو أسعاراً أو نتائج.
إذا لم تتوفري على معلومة، اطلبي توضيحاً.
هذه محادثة داخلية مع المدير فقط.

ممنوع عليك:
- إرسال رسائل إلى العملاء.
- إرسال رسائل واتساب أو بريد إلكتروني.
- نشر أي محتوى على مواقع التواصل.
- تنفيذ أي عمليات خارجية.
- تعديل بيانات الوكالة أو العملاء.
أنتِ تقدمين الاقتراحات والنصوص فقط.
`;

Deno.serve(
  withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 }
        );
      }

      const { data: isDirector, error: directorError } =
        await ctx.supabase.rpc("is_active_director");

      if (directorError || isDirector !== true) {
        return Response.json(
          { error: "غير مصرح. هذه المحادثة للمدير فقط." },
          { status: 403 }
        );
      }

      const apiKey = Deno.env.get("OPENAI_API_KEY");
      const model = Deno.env.get("OPENAI_MODEL");

      if (!apiKey || !model) {
        return Response.json(
          { error: "إعدادات الذكاء الاصطناعي غير مكتملة." },
          { status: 500 }
        );
      }

      const body = await req.json();
      const message = body.message;

      if (
        typeof message !== "string" ||
        message.trim().length === 0 ||
        message.length > 4000
      ) {
        return Response.json(
          { error: "الرسالة غير صحيحة أو طويلة جداً." },
          { status: 400 }
        );
      }

      const aiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            instructions: LEILA_INSTRUCTIONS,
            input: message.trim(),
            max_output_tokens: 800
          })
        }
      );

      if (!aiResponse.ok) {
        console.error("OpenAI request failed:", aiResponse.status);

        return Response.json(
          { error: "تعذر الحصول على رد من الذكاء الاصطناعي." },
          { status: 502 }
        );
      }

      const result = await aiResponse.json();

      const reply = (result.output ?? [])
        .flatMap((item: any) => item.content ?? [])
        .filter((item: any) => item.type === "output_text")
        .map((item: any) => item.text)
        .join("\n");

      if (!reply) {
        return Response.json(
          { error: "لم يصل رد نصي من ليلى." },
          { status: 502 }
        );
      }

      return Response.json({ reply });

    } catch (error) {
      console.error("Leila function error:", error);

      return Response.json(
        { error: "حدث خطأ أثناء تشغيل ليلى." },
        { status: 500 }
      );
    }
  })
);