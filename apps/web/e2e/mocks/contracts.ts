export const CONTRACT_TEMPLATE_1 = {
  id: 'tpl-1',
  name: 'Contrato padrão',
  bodyMarkdown: '# Contrato\n\nEste é o contrato padrão do studio.',
  version: 1,
  isActive: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

// /contract-templates returns flat array
export const templatesList = [CONTRACT_TEMPLATE_1];

export const PUBLIC_CONTRACT = {
  studioName: 'Anna Maria Pilates',
  status: 'sent',
  renderedHtml: '<h1>Contrato</h1><p>Termos do contrato para Ana Silva.</p>',
  signedAt: null,
  pdfAvailable: false,
};

export const SIGNED_PUBLIC_CONTRACT = {
  ...PUBLIC_CONTRACT,
  status: 'signed',
  signedAt: '2026-05-25T12:00:00.000Z',
  pdfAvailable: true,
};

// /drop-ins returns flat array
export const dropInsList: unknown[] = [];

export const dashboardSummary = {
  activeStudents: 2,
  activePlans: 1,
  upcomingSessionsToday: 1,
  pendingReceivables: '320.00',
};
