export const onRequest = (next: () => Response): Response => {
  return next();
};
