export default async (req, context) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Sunucu yapılandırma hatası: API anahtarı eksik." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Geçersiz istek gövdesi." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { imageB64, imageMime } = body;
  if (!imageB64 || !imageMime) {
    return new Response(
      JSON.stringify({ error: "imageB64 ve imageMime alanları zorunlu." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const SYSTEM = `Sen Meta'nın Andromeda reklam algoritmasını simüle eden uzman bir reklam analisti ve kreatif direktörsün.
Kullanıcının yüklediği reklam görselini, Meta'nın makine öğrenmesi modellerinin bakış açısıyla analiz edeceksin.

GÖREVIN:
1. Görseli META Andromeda perspektifiyle analiz et
2. Tam olarak 10 farklı reklam konsepti üret
3. Her konsept farklı bir persona ve hedef kitleyi hedeflemeli

ÇIKTI FORMATI: Yalnızca geçerli JSON döndür. Başka hiçbir şey yazma. Markdown code block kullanma.

JSON yapısı:
{
  "meta_analiz": {
    "satis_skoru": <0-100 arası sayı>,
    "algoritma_skoru": <0-100 arası sayı>,
    "tahmini_engagement": "<örn: %3.5 - %6.5>",
    "algilanan_kategori": "<kategori>",
    "algoritma_perspektifi": "<META algoritmasının bu görseli nasıl yorumladığını, hangi platformlarda öne çıkaracağını, hedef kitleyle nasıl eşleştireceğini 3-4 cümle ile açıkla>",
    "gorsel_unsurlar": ["<unsur1>", "<unsur2>", "<unsur3>", "<unsur4>", "<unsur5>"],
    "duygusal_ton": ["<ton1>", "<ton2>", "<ton3>"],
    "birincil_persona": "<kısa açıklama>",
    "ikincil_personalar": ["<persona1>", "<persona2>", "<persona3>"]
  },
  "konseptler": [
    {
      "numara": 1,
      "baslik": "<konsept adı>",
      "sahne_aciklamasi": "<görselin nasıl çekileceği / kurgulanacağı — 2-3 cümle>",
      "donusum_potansiyeli": <0-100>,
      "amac": "<bu konseptin pazarlama amacı>",
      "hedef_kitle_ozet": "<kısa özet>",
      "hedef_kitle_detay": "<yaş, meslek, yaşam tarzı detayı>",
      "kullanim_alani": "<nerede kullanılır>",
      "fayda": "<ürünün sunduğu somut fayda>",
      "etki": "<istenilen psikolojik etki>",
      "duygusal_tetikleyici": "<ana duygusal tetikleyici>",
      "hook": "<dikkat çekici açılış cümlesi>",
      "cta": "<harekete geçirici çağrı>",
      "reklam_basligi": "<max 25 karakter META reklam başlığı>",
      "reklam_metinleri": [
        "<1. reklam metni — sosyal kanıt içerebilir>",
        "<2. reklam metni — ürün özelliği odaklı>",
        "<3. reklam metni — aciliyet/kıtlık içerebilir>"
      ],
      "promptlar": {
        "chatgpt_temiz": "<ChatGPT/DALL-E için yazısız görsel prompt — İngilizce, detaylı>",
        "chatgpt_yazili": "<ChatGPT/DALL-E için başlık+CTA+simgeler içeren görsel prompt — İngilizce, detaylı>",
        "gemini_temiz": "<Gemini Imagen için yazısız görsel prompt — İngilizce, detaylı>",
        "gemini_yazili": "<Gemini Imagen için başlık+CTA+simgeler içeren görsel prompt — İngilizce, detaylı>"
      }
    }
  ]
}`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 8000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: imageMime, data: imageB64 },
              },
              {
                type: "text",
                text: "Bu reklam görselini analiz et ve tam olarak 10 konsept üret. Yalnızca JSON döndür.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errData = await anthropicRes.json();
      throw new Error(errData.error?.message || `Anthropic API hatası: ${anthropicRes.status}`);
    }

    const data = await anthropicRes.json();
    const raw = data.content.map((b) => b.text || "").join("");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("API geçerli JSON döndürmedi.");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};

export const config = { path: "/api/analyze" };
