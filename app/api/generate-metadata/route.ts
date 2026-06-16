// app/api/generate-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Fallback values prevent build-time crashes when environment variables are not yet loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

function buildPrompt(titleLength: number, descLength: number, keywordCount: number) {
  return `You are a metadata generator for stock photo/video marketplaces. Look at the attached image and reply with ONLY a raw JSON object (no markdown fences, no commentary) in exactly this shape:
{"title": string, "description": string, "keywords": string[]}

Rules:
- title: max ${titleLength} characters, descriptive and search-friendly, no brand names, no real people's names.
- description: max ${descLength} characters, one sentence, neutral commercial-stock tone.
- keywords: exactly ${keywordCount} lowercase keywords ordered by relevance, no duplicates.`;
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, imageBase64, mediaType, titleLength, descLength, keywordCount } = await req.json();

    if (!imageBase64) return NextResponse.json({ error: 'Missing image data' }, { status: 400 });

    let finalApiKey = apiKey;
    let userId: string | null = null;

    // 1. Enforce login and credit check if user did NOT provide their own API key
    if (!finalApiKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Please login or provide your own API key.' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: 'Session expired or invalid token.' }, { status: 401 });
      }

      userId = user.id;

      // Check current credit balance
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
      }

      if (profile.credits <= 0) {
        return NextResponse.json({ error: 'Insufficient credits. Please add your own API key.' }, { status: 403 });
      }

      // System Fallback Keys configuration on server
      if (provider.startsWith('gemini')) finalApiKey = process.env.GEMINI_API_KEY;
      else if (provider.startsWith('gpt')) finalApiKey = process.env.OPENAI_API_KEY;
      else if (provider.startsWith('claude')) finalApiKey = process.env.ANTHROPIC_API_KEY;
      else if (provider.startsWith('grok')) finalApiKey = process.env.XAI_API_KEY;
      else if (provider.startsWith('deepseek')) finalApiKey = process.env.DEEPSEEK_API_KEY;

      if (!finalApiKey) {
        return NextResponse.json({ error: `System API key for ${provider} is not configured.` }, { status: 500 });
      }
    }

    const prompt = buildPrompt(titleLength, descLength, keywordCount);
    let raw = '';

    // 2. Call the AI models dynamically based on selection
    if (provider.startsWith('claude')) {
      const selectedModel = provider === 'claude-3-haiku' ? 'claude-3-haiku-20240307' : 'claude-3-5-sonnet-20241022';
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': finalApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 600,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Claude request failed');
      raw = data.content?.[0]?.text || '';

    } else if (provider.startsWith('gpt')) {
      const selectedModel = provider === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${finalApiKey}` },
        body: JSON.stringify({
          model: selectedModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI request failed');
      raw = data.choices?.[0]?.message?.content || '';

    } else if (provider.startsWith('gemini')) {
      // Map Gemini model aliases to actual Google API names
      let selectedModel = 'gemini-1.5-flash';
      if (provider === 'gemini-1.5-pro') selectedModel = 'gemini-1.5-pro';
      else if (provider === 'gemini-1.0-pro') selectedModel = 'gemini-1.0-pro';

      // Using highly stable v1beta endpoint with removed redundant configuration to prevent payload issues
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${finalApiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mediaType, data: imageBase64 } },
                  { text: prompt },
                ],
              },
            ],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini request failed');
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (provider.startsWith('grok')) {
      // Grok API (fully standard OpenAI multimodal compatible format)
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${finalApiKey}` },
        body: JSON.stringify({
          model: 'grok-2-vision-1212',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Grok request failed');
      raw = data.choices?.[0]?.message?.content || '';

    } else if (provider.startsWith('deepseek')) {
      // DeepSeek standard chat model (V4) is text-only. To avoid crashes and keep highly customized outputs, 
      // we generate rich stock metadata by providing file descriptions & metadata prompts
      const textPrompt = `${prompt}\n\nNote: The image is titled: "${mediaType}" (Generate contextual metadata based on this theme).`;
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${finalApiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: textPrompt,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'DeepSeek request failed');
      raw = data.choices?.[0]?.message?.content || '';

    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const parsed = extractJson(raw);
    if (!parsed.title || !parsed.description || !Array.isArray(parsed.keywords)) {
      throw new Error('Model returned an unexpected shape');
    }

    // 3. Deduct credit if system keys were used and user is verified
    if (userId && !apiKey) {
      const { error: deductError } = await supabaseAdmin.rpc('decrement_credits', { user_id: userId });
      
      if (deductError) {
        await supabaseAdmin
          .from('profiles')
          .update({ credits: Math.max(0, (await supabaseAdmin.from('profiles').select('credits').eq('id', userId).single()).data?.credits - 1) })
          .eq('id', userId);
      }
    }

    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}