// Rendu DOM du client PWA : fin, sans logique métier. Les décisions (champs, appel API, validation,
// libellés du rapport) vivent dans des fonctions pures testées (formView, wakeUpApi, reportView).
// Les données ne passent jamais par `innerHTML` : uniquement `textContent` et des attributs.
import './style.css';
import { describeFormFields, toWakeUpRequest, type FormFieldDescription } from './formView.ts';
import { toReportViewModel, type ReportViewModel } from './reportView.ts';
import { requestWakeUp, type WakeUpOutcome } from './wakeUpApi.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) mount(root);

function mount(container: HTMLElement): void {
  const heading = element('h1', 'Réveil musical');
  const intro = element(
    'p',
    'Déclenchez un réveil de démonstration : le serveur choisit un morceau selon le jour et la météo, puis notifie l’utilisateur sur son canal préféré.',
  );

  const form = document.createElement('form');
  for (const field of describeFormFields()) form.append(renderField(field));
  const submit = element('button', 'Déclencher le réveil');
  submit.type = 'submit';
  form.append(submit);

  // Région annoncée aux lecteurs d'écran : son contenu est remplacé à chaque résultat.
  const result = document.createElement('section');
  result.className = 'result';
  result.setAttribute('aria-live', 'polite');
  result.setAttribute('aria-label', 'Résultat du réveil');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void onSubmit(form, submit, result);
  });

  container.replaceChildren(heading, intro, form, result);
}

async function onSubmit(
  form: HTMLFormElement,
  submit: HTMLButtonElement,
  result: HTMLElement,
): Promise<void> {
  const data = new FormData(form);
  const request = toWakeUpRequest({
    userId: formValue(data, 'userId'),
    dayOfWeek: formValue(data, 'dayOfWeek'),
    weather: formValue(data, 'weather'),
  });
  if (request === undefined) {
    renderOutcome(result, {
      kind: 'invalid-request',
      message: 'Saisie invalide : renseignez l’utilisateur, le jour et la météo.',
    });
    return;
  }

  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  try {
    // Seul appel réseau du client, vers notre API (ADR-0001) ; requestWakeUp ne rejette jamais.
    renderOutcome(result, await requestWakeUp(request, (input, init) => fetch(input, init)));
  } finally {
    // Le formulaire reste utilisable quoi qu'il arrive (CA-WEB-05).
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  }
}

function renderField(field: FormFieldDescription): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const label = element('label', field.label);
  label.htmlFor = field.id;

  if (field.type === 'select') {
    const select = document.createElement('select');
    select.id = field.id;
    select.name = field.id;
    select.required = true;
    for (const option of field.options) {
      const node = element('option', option.label);
      node.value = option.value;
      select.append(node);
    }
    wrapper.append(label, select);
  } else {
    const input = document.createElement('input');
    input.id = field.id;
    input.name = field.id;
    input.type = 'text';
    input.required = true;
    input.autocomplete = 'off';
    input.spellcheck = false;
    wrapper.append(label, input);
  }
  return wrapper;
}

function renderOutcome(result: HTMLElement, outcome: WakeUpOutcome): void {
  if (outcome.kind === 'report') {
    result.replaceChildren(renderReport(toReportViewModel(outcome.report)));
    return;
  }
  const alert = element('p', outcome.message);
  alert.className = 'error';
  alert.setAttribute('role', 'alert');
  result.replaceChildren(alert);
}

function renderReport(view: ReportViewModel): HTMLElement {
  const card = document.createElement('article');
  card.className = 'report';
  card.append(element('h2', view.title));
  if (view.degradedBadge) {
    const badge = element('p', 'Mode dégradé');
    badge.className = 'badge';
    card.append(badge);
  }
  card.append(element('p', view.artist));

  if (view.link !== undefined) {
    const link = element('a', 'Écouter le morceau');
    link.href = view.link;
    link.target = '_blank';
    link.rel = 'noopener';
    const paragraph = document.createElement('p');
    paragraph.append(link);
    card.append(paragraph);
  }

  card.append(element('p', view.deliveredVia), element('h3', 'Tentatives'));
  const attempts = document.createElement('ol');
  for (const attempt of view.attempts) attempts.append(element('li', attempt));
  card.append(attempts);
  return card;
}

function formValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
