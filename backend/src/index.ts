import OpenAI from "openai";

// 服务启动时创建一次 OpenAI 客户端，后续请求复用它。
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY,
});

export async function POST(req: Request) {
    try {
        // 读取前端 POST 过来的消息数组。
        const { messages } = await req.json();

        // 开启流式输出，让模型逐段返回内容而不是一次性返回完整结果。
        const stream = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            stream: true,
        });

        // ReadableStream 需要字节数据，先准备一个文本编码器。
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                // 逐个消费 OpenAI 返回的流式分片。
                for await (const chunk of stream) {
                    // 每个 chunk 里只取本次新增的文本内容。
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        // 按 SSE 格式推送给前端：data: ...\n\n
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                    }
                }

                // 告诉前端流已经结束，然后关闭响应流。
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            },
        });

        // 以 SSE 响应返回，前端可以边收边渲染内容。
        return new Response(readable, {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        });
    } catch (e) {
        // 任何一步失败都记录日志，并返回统一的 500 错误。
        console.error(e);
        return new Response(
            JSON.stringify({ error: "stream creation failed" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                },
            },
        );
    }
}
