/** Erreur racine du domaine : toute violation d'invariant métier en hérite. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
