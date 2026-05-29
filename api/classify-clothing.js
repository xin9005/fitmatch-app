module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY in Vercel environment variables." });
  }

  try {
    const { imageDataUrl } = req.body || {};
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Missing imageDataUrl." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "你是服装衣柜识别助手。请根据图片识别单件或主体衣服。",
                  "只返回 JSON，不要 Markdown。",
                  "字段：name, category, color, style, confidence。",
                  "category 必须是 top, outer, bottom, dress, shoes, bag 之一。",
                  "color 必须是 white, black, gray, navy, blue, brown, pink, green 之一。",
                  "style 必须是 minimal, commute, korean, soft, casual 之一。",
                  "name 用中文，简短。例如：黑色衬衫、棕色短靴、米色手提包。",
                  "如果图片有多个物品，请识别画面中最主要、最清楚的那一件。",
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "low",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI request failed.",
        code: data.error?.code || null,
      });
    }

    const text = extractText(data);
    return res.status(200).json(normalize(JSON.parse(text)));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to classify clothing." });
  }
};

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const parts = data.output || [];
  for (const item of parts) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("No text returned by AI.");
}

function normalize(input) {
  const categoryValues = ["top", "outer", "bottom", "dress", "shoes", "bag"];
  const colorValues = ["white", "black", "gray", "navy", "blue", "brown", "pink", "green"];
  const styleValues = ["minimal", "commute", "korean", "soft", "casual"];
  return {
    name: String(input.name || "未命名单品").slice(0, 24),
    category: pick(input.category, categoryValues, "top"),
    color: pick(input.color, colorValues, "white"),
    style: pick(input.style, styleValues, "minimal"),
    confidence: Number(input.confidence || 0),
  };
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}
