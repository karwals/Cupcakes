const WHATSAPP_GRAPH_API_VERSION = "v25.0";
const WHATSAPP_TEMPLATE_NAME = "hello_world";
const WHATSAPP_TEMPLATE_LANGUAGE = "en_US";

type SendWhatsAppRequest = {
  phone?: unknown;
};

type MetaApiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type MetaSuccessBody = {
  messages?: Array<{
    id?: string;
  }>;
};

type JsonResponseBody =
  | {
      success: true;
      message: string;
      messageId?: string;
    }
  | {
      success: false;
      error: string;
    };

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await parseJsonBody(request);

  if (!body) {
    return jsonResponse(
      {
        success: false,
        error: "Please send a valid JSON request.",
      },
      400,
    );
  }

  const phoneResult = normalizePhoneNumber(body.phone);

  if (!phoneResult.success) {
    return jsonResponse(
      {
        success: false,
        error: phoneResult.error,
      },
      400,
    );
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.error("WhatsApp confirmation is not configured", {
      hasAccessToken: Boolean(accessToken),
      hasPhoneNumberId: Boolean(phoneNumberId),
    });

    return jsonResponse(
      {
        success: false,
        error: "WhatsApp confirmations are not configured yet.",
      },
      500,
    );
  }

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneResult.phone,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: {
              code: WHATSAPP_TEMPLATE_LANGUAGE,
            },
          },
        }),
      },
    );

    const metaBody = await readJsonResponse(metaResponse);

    if (!metaResponse.ok) {
      const metaError = getMetaError(metaBody);

      console.error("WhatsApp Cloud API request failed", {
        status: metaResponse.status,
        code: metaError?.code,
        subcode: metaError?.error_subcode,
        type: metaError?.type,
        message: metaError?.message,
        fbtraceId: metaError?.fbtrace_id,
        recipientLast4: phoneResult.phone.slice(-4),
      });

      return jsonResponse(
        {
          success: false,
          error: "Unable to send the WhatsApp confirmation. Please check the number and try again.",
        },
        502,
      );
    }

    const messageId = getMessageId(metaBody);

    return jsonResponse({
      success: true,
      message: "WhatsApp confirmation sent.",
      ...(messageId ? { messageId } : {}),
    });
  } catch (error) {
    console.error("WhatsApp confirmation request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      recipientLast4: phoneResult.phone.slice(-4),
    });

    return jsonResponse(
      {
        success: false,
        error: "Unable to send the WhatsApp confirmation right now. Please try again.",
      },
      502,
    );
  }
}

async function parseJsonBody(request: Request): Promise<SendWhatsAppRequest | null> {
  try {
    const json = (await request.json()) as unknown;

    if (!json || typeof json !== "object") {
      return null;
    }

    return json as SendWhatsAppRequest;
  } catch {
    return null;
  }
}

function normalizePhoneNumber(
  phone: unknown,
):
  | {
      success: true;
      phone: string;
    }
  | {
      success: false;
      error: string;
    } {
  if (typeof phone !== "string" || !phone.trim()) {
    return {
      success: false,
      error: "Please enter a WhatsApp phone number.",
    };
  }

  const normalizedPhone = phone.replace(/[\s()+\-[\]{}]/g, "");

  if (!/^[1-9]\d{7,14}$/.test(normalizedPhone)) {
    return {
      success: false,
      error: "Please enter a valid WhatsApp number with country code.",
    };
  }

  return {
    success: true,
    phone: normalizedPhone,
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function getMetaError(body: unknown): MetaApiErrorBody["error"] {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return undefined;
  }

  const { error } = body as MetaApiErrorBody;

  return error;
}

function getMessageId(body: unknown) {
  if (!body || typeof body !== "object" || !("messages" in body)) {
    return undefined;
  }

  const { messages } = body as MetaSuccessBody;

  return messages?.[0]?.id;
}

function jsonResponse(body: JsonResponseBody, status = 200) {
  return Response.json(body, { status });
}
