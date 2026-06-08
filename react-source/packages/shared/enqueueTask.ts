export default function enqueueTask(task: () => void): void {
  queueMicrotask(task);
}
