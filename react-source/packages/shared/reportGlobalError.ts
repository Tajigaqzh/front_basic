export default function reportGlobalError(error: unknown): void {
  setTimeout(() => {
    throw error;
  });
}
