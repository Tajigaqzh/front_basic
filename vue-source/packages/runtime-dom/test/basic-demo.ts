import { ref } from "../../reactivity/src";
import { h } from "../../runtime-core/src";
import { createApp } from "../src";

// 这是一个最小运行 demo，用来验证当前这套 runtime-core/runtime-dom 主链。
// 使用方式：
// 1. 在浏览器环境准备一个 <div id="app"></div>
// 2. 执行这个文件里的 mountDemo()
// 3. 点击按钮，观察 count、props、emit、slots 是否都能走通

const Counter = {
    props: {
        initial: Number,
        label: {
            type: String,
            default: "count",
        },
    },
    emits: ["change"],
    setup(props: Record<string, unknown>, { emit, slots }: any) {
        const count = ref(Number(props.initial ?? 0));

        const inc = () => {
            count.value += 1;
            emit("change", count.value);
        };

        return () =>
            h("section", { class: "counter-card" }, [
                h("h2", `${props.label}: ${count.value}`),
                h("button", { onClick: inc }, "increment"),
                h("div", { class: "slot-area" }, slots.default ? slots.default({ count: count.value }) : []),
            ]);
    },
};

export function mountDemo(): void {
    createApp({
        setup() {
            const latest = ref(0);

            return () =>
                h("main", { class: "demo-root" }, [
                    h("h1", "runtime-dom demo"),
                    h(Counter, {
                        initial: 1,
                        label: "clicks",
                        onChange: (value: number) => {
                            latest.value = value;
                        },
                    }, {
                        default: ({ count }: { count: number }) =>
                            h("p", `slot sees count = ${count}`),
                    }),
                    h("p", `latest emitted value = ${latest.value}`),
                ]);
        },
    }).mount("#app");
}
