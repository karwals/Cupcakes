const WHATSAPP_GRAPH_API_VERSION = "v25.0";
const WHATSAPP_TEMPLATE_NAME = "cupcake_order_confirmation";
const WHATSAPP_TEMPLATE_LANGUAGE = "en";

type SendWhatsAppRequest = {
  phone?: unknown;
  customerName?: unknown;
  orderReference?: unknown;
  cupcakeName?: unknown;
  flavour?: unknown;
  quantity?: unknown;
  collectionMethod?: unknown;
};

type WhatsAppTemplateFields = {
  customerName: string;
  orderReference: string;
  cupcakeName: string;
  flavour: string;
  quantity: string;
  collectionMethod: string;
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

  const templateFieldsResult = validateTemplateFields(body);

  if (!templateFieldsResult.success) {
    return jsonResponse(
      {
        success: false,
        error: templateFieldsResult.error,
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
            components: [
              {
                type: "body",
                parameters: [
                  createTextParameter(templateFieldsResult.fields.customerName),
                  createTextParameter(templateFieldsResult.fields.orderReference),
                  createTextParameter(templateFieldsResult.fields.cupcakeName),
                  createTextParameter(templateFieldsResult.fields.flavour),
                  createTextParameter(templateFieldsResult.fields.quantity),
                  createTextParameter(templateFieldsResult.fields.collectionMethod),
                ],
              },
            ],
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

function validateTemplateFields(
  body: SendWhatsAppRequest,
):
  | {
      success: true;
      fields: WhatsAppTemplateFields;
    }
  | {
      success: false;
      error: string;
    } {
  const customerName = getRequiredTextField(body.customerName, "customer name");
  const orderReference = getRequiredTextField(body.orderReference, "order reference");
  const cupcakeName = getRequiredTextField(body.cupcakeName, "cupcake name");
  const flavour = getRequiredTextField(body.flavour, "flavour");
  const quantity = getRequiredQuantityField(body.quantity);
  const collectionMethod = getRequiredTextField(body.collectionMethod, "collection method");

  if (!customerName.success) {
    return customerName;
  }

  if (!orderReference.success) {
    return orderReference;
  }

  if (!cupcakeName.success) {
    return cupcakeName;
  }

  if (!flavour.success) {
    return flavour;
  }

  if (!quantity.success) {
    return quantity;
  }

  if (!collectionMethod.success) {
    return collectionMethod;
  }

  return {
    success: true,
    fields: {
      customerName: customerName.value,
      orderReference: orderReference.value,
      cupcakeName: cupcakeName.value,
      flavour: flavour.value,
      quantity: quantity.value,
      collectionMethod: collectionMethod.value,
    },
  };
}

function getRequiredTextField(
  value: unknown,
  label: string,
):
  | {
      success: true;
      value: string;
    }
  | {
      success: false;
      error: string;
    } {
  if (typeof value !== "string" || !value.trim()) {
    return {
      success: false,
      error: `Please provide a ${label}.`,
    };
  }

  return {
    success: true,
    value: value.trim(),
  };
}

function getRequiredQuantityField(
  value: unknown,
):
  | {
      success: true;
      value: string;
    }
  | {
      success: false;
      error: string;
    } {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return {
      success: true,
      value: String(value),
    };
  }

  if (typeof value === "string" && value.trim()) {
    return {
      success: true,
      value: value.trim(),
    };
  }

  return {
    success: false,
    error: "Please provide a valid quantity.",
  };
}

function createTextParameter(text: string) {
  return {
    type: "text",
    text,
  };
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
