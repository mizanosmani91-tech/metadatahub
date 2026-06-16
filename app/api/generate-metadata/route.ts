// app/api/generate-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin with Service Role for secure database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

    // 1. If user did NOT provide their own API key, enforce login and credit check
    if (!finalApiKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized. Please login or provide your own API key.' }, { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json({ error: 'Session expired or invalid user token.' }, { status: 401 });
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
        return NextResponse.json({ error: 'Insufficient credits. Please add your own API key to continue.' }, { status: 403 });
      }

      // Fallback to system admin keys
      if (provider === 'gemini-1.5-flash') finalApiKey = process.env.GEMINI_API_KEY;
      else if (provider === 'gpt-4o') finalApiKey = process.env.OPENAI_API_KEY;
      else if (provider === 'claude-3-5') finalApiKey = process.env.ANTHROPIC_API_KEY;

      if (!finalApiKey) {
        return NextResponse.json({ error: `System API key for ${provider} is not configured on server.` }, { status: 500 });
      }
    }

    const prompt = buildPrompt(titleLength, descLength, keywordCount);
    let raw = '';

    // 2. Call the AI models
    if (provider === 'claude-3-5') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': finalApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
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

    } else if (provider === 'gpt-4o') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${finalApiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
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

    } else if (provider === 'gemini-1.5-flash') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${finalApiKey}`,
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
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini request failed');
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
      
      // Fallback if RPC function is not created: manually decrement credits
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