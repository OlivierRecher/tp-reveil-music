/** Arguments du script `npm run wake` absents ou invalides : message destiné à l'utilisateur. */
export class WakeArgsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WakeArgsError';
  }
}
