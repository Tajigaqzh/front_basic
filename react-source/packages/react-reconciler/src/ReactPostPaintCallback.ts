import { requestPostPaintCallback } from "./ReactFiberConfig.js";

let postPaintCallbackScheduled = false;
let callbacks: Array<(endTime: number) => void> = [];

export function schedulePostPaintCallback(callback: (endTime: number) => void): void {
  callbacks.push(callback);
  if (postPaintCallbackScheduled) {
    return;
  }

  postPaintCallbackScheduled = true;
  requestPostPaintCallback((endTime) => {
    const pendingCallbacks = callbacks;
    callbacks = [];
    postPaintCallbackScheduled = false;
    // 官方在 paint 后批量 flush；这里保留“同一帧只调度一次”的合并语义。
    for (const pendingCallback of pendingCallbacks) {
      pendingCallback(endTime);
    }
  });
}
