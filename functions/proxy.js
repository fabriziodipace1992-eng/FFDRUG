export async function onRequestPost(context) {
  const body = await context.request.text();
  const apiKey = context.request.headers.get("x-api-key") || "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: body
  });

  const data = await response.text();

  // Debug: includi info nella risposta se errore
  if (!response.ok) {
    const debug = JSON.stringify({
      status: response.status,
      keyLength: apiKey.length,
      keyStart: apiKey.substring(0, 10),
      body: JSON.parse(data)
    });
    return new Response(debug, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  return new Response(data, {
    status: response.status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version"
    }
  });
}
