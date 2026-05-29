// Audio analysis config — API keys loaded from Vercel env
const ENV_PREFIX="GEMINI";
export const API_KEY=(process.env as Record<string,string|undefined>)[ENV_PREFIX+"_API_KEY"]||"";
export const API_BASE="https://generativelanguage.googleapis.com/v1beta";
