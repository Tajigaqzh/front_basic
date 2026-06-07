import { FormEvent, useState } from "react";

import { useChatStream } from "./hooks/useStream";

const apiUrl = import.meta.env.VITE_API_URL || "/api/chat";

export function App() {
    const [input, setInput] = useState("");
    const { messages, isLoading, error, sendMessage, stop, reset } = useChatStream({
        apiUrl,
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!input.trim()) {
            return;
        }

        const currentInput = input;
        setInput("");
        await sendMessage(currentInput);
    };

    return (
        <main className="app-shell">
            <section className="chat-card">
                <header className="chat-header">
                    <div>
                        <p className="eyebrow">Streaming Demo</p>
                        <h1>OpenAI Chat Stream</h1>
                    </div>
                    <button className="ghost-button" onClick={reset} type="button">
                        Clear
                    </button>
                </header>

                <div className="message-list">
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <p>Send a message to start the stream.</p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <article
                                className={`message message-${message.role}`}
                                key={message.id}
                            >
                                <span className="message-role">{message.role}</span>
                                <p>{message.content || (message.role === "assistant" ? "..." : "")}</p>
                            </article>
                        ))
                    )}
                </div>

                {error ? <p className="error-text">{error}</p> : null}

                <form className="composer" onSubmit={handleSubmit}>
                    <textarea
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask something..."
                        rows={4}
                        value={input}
                    />
                    <div className="actions">
                        <button disabled={isLoading || !input.trim()} type="submit">
                            {isLoading ? "Streaming..." : "Send"}
                        </button>
                        <button
                            className="ghost-button"
                            disabled={!isLoading}
                            onClick={stop}
                            type="button"
                        >
                            Stop
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
