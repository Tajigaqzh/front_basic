import { useCallback, useRef, useState } from "react";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

interface UseChatStreamOptions {
    apiUrl?: string;
}

interface StreamPayload {
    content?: string;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
    const { apiUrl = "/api/chat" } = options;
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stop = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
    }, []);

    const reset = useCallback(() => {
        stop();
        setMessages([]);
        setError(null);
    }, [stop]);

    const sendMessage = useCallback(
        async (inputMessage: string) => {
            const content = inputMessage.trim();
            if (!content || isLoading) {
                return;
            }

            setError(null);

            const userMsg: Message = {
                id: crypto.randomUUID(),
                role: "user",
                content,
            };

            const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "",
            };

            const nextMessages = [...messages, userMsg, assistantMsg];
            setMessages(nextMessages);
            setIsLoading(true);

            abortControllerRef.current = new AbortController();

            try {
                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messages: nextMessages
                            .filter((msg) => msg.role === "user" || msg.content)
                            .map((msg) => ({
                                role: msg.role,
                                content: msg.content,
                            })),
                    }),
                    signal: abortControllerRef.current.signal,
                });

                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                if (!response.body) {
                    throw new Error("Response body is empty");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split("\n\n");
                    buffer = events.pop() ?? "";

                    for (const event of events) {
                        const line = event.trim();
                        if (!line.startsWith("data:")) {
                            continue;
                        }

                        const data = line.slice(5).trim();
                        if (data === "[DONE]") {
                            setIsLoading(false);
                            abortControllerRef.current = null;
                            return;
                        }

                        const payload = JSON.parse(data) as StreamPayload;
                        if (!payload.content) {
                            continue;
                        }

                        setMessages((prevState) =>
                            prevState.map((msg) =>
                                msg.id === assistantMsg.id
                                    ? { ...msg, content: msg.content + payload.content! }
                                    : msg,
                            ),
                        );
                    }
                }

                setIsLoading(false);
                abortControllerRef.current = null;
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") {
                    return;
                }

                setError(e instanceof Error ? e.message : "Unknown error");
                setMessages((prevState) => prevState.filter((msg) => msg.id !== assistantMsg.id));
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        },
        [apiUrl, isLoading, messages],
    );

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        stop,
        reset,
    };
}
