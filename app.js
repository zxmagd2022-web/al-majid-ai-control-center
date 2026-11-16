import { createClient } from "@supabase/supabase-js";
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

interface ReqPayload {
  name?: unknown;
}

console.info("AL MAJID - Secure endpoint started");

export default {
  fetch: withSupabase(
    { auth: ["publishable"] },
    async (req, ctx) => {
      // 1. Allow POST requests only
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          {
            status: 405,
            headers: { Allow: "POST" },
          }
        );
      }

      // 2. Validate JSON request
      let payload: unknown;

      try {
        payload = await req.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON request" },
          { status: 400 }
        );
      }

      // 3. Validate request structure
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("name" in payload) ||
        typeof payload.name !== "string"
      ) {
        return Response.json(
          { error: "Invalid request data" },
          { status: 400 }
        );
      }

      // 4. Validate name
      const name = payload.name.trim();

      if (
        name.length === 0 ||
        name.length > 100
      ) {
        return Response.json(
          { error: "Name must be between 1 and 100 characters" },
          { status: 400 }
        );
      }

      // 5. Return safe response
      return Response.json(
        {
          success: true,
          message: `Hello ${name}!`,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }
  ),
};
