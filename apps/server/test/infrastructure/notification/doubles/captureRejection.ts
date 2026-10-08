/** Attend la promesse et renvoie la raison de son rejet, ou échoue si elle est résolue. */
export async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('La promesse aurait dû être rejetée, elle a été résolue');
    },
    (reason: unknown) => reason,
  );
}
