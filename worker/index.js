// AL MAJID AI CONTROL CENTER — isolated development static-asset worker
// This worker serves only the files in ./public. It does not access Supabase secrets.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
