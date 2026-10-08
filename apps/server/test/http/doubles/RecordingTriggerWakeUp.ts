import type { TriggerWakeUp, WakeUpCommand, WakeUpReport } from '@reveil/core';

type Behavior = (command: WakeUpCommand) => Promise<WakeUpReport>;

/**
 * Doublure du cas d'usage écrite à la main : enregistre chaque commande reçue (donc chaque envoi
 * déclenché) et renvoie le rapport scripté, ou rejette.
 */
export class RecordingTriggerWakeUp implements Pick<TriggerWakeUp, 'execute'> {
  readonly commands: WakeUpCommand[] = [];
  #behavior: Behavior;

  constructor(report: WakeUpReport) {
    this.#behavior = () => Promise.resolve(report);
  }

  get calls(): number {
    return this.commands.length;
  }

  failWith(error: Error): this {
    this.#behavior = () => Promise.reject(error);
    return this;
  }

  execute(command: WakeUpCommand): Promise<WakeUpReport> {
    this.commands.push(command);
    return this.#behavior(command);
  }
}
