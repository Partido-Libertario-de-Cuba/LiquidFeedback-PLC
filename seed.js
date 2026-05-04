// PLC · Ágora Digital — datos iniciales (modelo LiquidFeedback)
// Entidades: unidad, policies, áreas (células), issues, initiatives, drafts,
// suggestions, supporters, votes (preferenciales), delegations, audit.
import { randomUUID } from 'node:crypto';

const iso = (s) => new Date(s).toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();

export function seed() {
  // ========== UNIDAD ==========
  const unit = {
    id: 'u_plc',
    name: 'Partido Libertario de Cuba',
    acronym: 'PLC',
    foundedAt: '2025-10-01T00:00:00.000Z',
  };

  // ========== POLICIES (reglas de fases) ==========
  // Duraciones y quórums — cada issue sigue una policy.
  const policies = [
    {
      id: 'pol_standard',
      name: 'Política estándar',
      description: 'Reglas por defecto para decisiones operativas del Partido.',
      admissionDays: 7,
      discussionDays: 14,
      verificationDays: 3,
      votingDays: 3,
      issueQuorum: 0.10,      // 10% de afiliados deben apoyar para pasar admisión
      initiativeQuorum: 0.10, // 10% para que una iniciativa entre a votación
    },
    {
      id: 'pol_constitutional',
      name: 'Política constitucional',
      description: 'Decisiones que tocan principios fundacionales (Título II).',
      admissionDays: 14,
      discussionDays: 30,
      verificationDays: 7,
      votingDays: 7,
      issueQuorum: 0.33,
      initiativeQuorum: 0.33,
    },
    {
      id: 'pol_urgent',
      name: 'Política urgente',
      description: 'Decisiones tácticas con ventana corta.',
      admissionDays: 2,
      discussionDays: 3,
      verificationDays: 1,
      votingDays: 2,
      issueQuorum: 0.20,
      initiativeQuorum: 0.20,
    },
  ];

  // ========== CÉLULAS (áreas temáticas) ==========
  const celulas = [
    { id: 'cel_gestion',    slug: 'gestion',    code: 'I',   name: 'Célula de Gestión',               article: 13, purpose: 'Facilitar los procesos y proyectos de la Organización, optimizando la mejora continua.' },
    { id: 'cel_legal',      slug: 'legal',      code: 'II',  name: 'Célula Legal',                    article: 14, purpose: 'Actuar como interfaz entre la estructura interna dinámica del Partido y los requisitos estáticos de las leyes del Estado.' },
    { id: 'cel_economia',   slug: 'economia',   code: 'III', name: 'Célula Económica y Financiera',   article: 15, purpose: 'Gestionar el flujo de recursos necesarios para el funcionamiento de la Organización, con transparencia radical.' },
    { id: 'cel_ti',         slug: 'ti',         code: 'IV',  name: 'Célula de TI e Infraestructura',  article: 16, purpose: 'Construir y mantener la infraestructura digital que hace posible el funcionamiento de la Organización.' },
    { id: 'cel_rrhh',       slug: 'rrhh',       code: 'V',   name: 'Célula de Recursos Humanos',      article: 17, purpose: 'Optimizar todo lo relacionado con el elemento más importante del Partido: el individuo.' },
    { id: 'cel_propaganda', slug: 'propaganda', code: 'VI',  name: 'Célula de Propaganda y Comunicaciones', article: 18, purpose: 'Amplificar la voz del Partido Libertario de Cuba en el entorno externo.' },
  ];

  // ========== AFILIADOS ==========
  const affiliates = [
    { id: 'af_001', handle: 'c.martel',   name: 'Claudia Martel',    joined: '2025-11-03', city: 'La Habana',      bio: 'Coordinadora temporal de logística.' },
    { id: 'af_002', handle: 'r.estevez',  name: 'Rodrigo Estévez',   joined: '2025-11-05', city: 'Miami',          bio: 'Desarrollador, firma digital.' },
    { id: 'af_003', handle: 'e.quintana', name: 'Elena Quintana',    joined: '2025-11-08', city: 'Santiago',       bio: 'Economista, enfoque en dolarización.' },
    { id: 'af_004', handle: 'j.barreto',  name: 'Javier Barreto',    joined: '2025-11-12', city: 'Tampa',          bio: 'Abogado constitucionalista.' },
    { id: 'af_005', handle: 'm.delacruz', name: 'Mirta de la Cruz',  joined: '2025-11-19', city: 'Matanzas',       bio: 'Periodista independiente.' },
    { id: 'af_006', handle: 'a.prieto',   name: 'Ariel Prieto',      joined: '2025-11-23', city: 'Madrid',         bio: 'Ingeniero de seguridad.' },
    { id: 'af_007', handle: 'l.gonzalez', name: 'Lidia González',    joined: '2025-12-01', city: 'Camagüey',       bio: 'Gestora de proyectos.' },
    { id: 'af_008', handle: 't.valdes',   name: 'Tomás Valdés',      joined: '2025-12-09', city: 'Holguín',        bio: 'Médico, activista.' },
    { id: 'af_009', handle: 'n.ferrer',   name: 'Noemí Ferrer',      joined: '2026-01-04', city: 'Cienfuegos',     bio: 'Educadora.' },
    { id: 'af_010', handle: 'd.sanchez',  name: 'Diego Sánchez',     joined: '2026-01-14', city: 'Pinar del Río',  bio: 'Criptógrafo, auditor.' },
    { id: 'af_011', handle: 'p.montero',  name: 'Paula Montero',     joined: '2026-02-02', city: 'New Jersey',     bio: 'Diseñadora visual.' },
    { id: 'af_012', handle: 's.olivera',  name: 'Sergio Olivera',    joined: '2026-02-20', city: 'Villa Clara',    bio: 'Agricultor, exiliado interno.' },
  ];

  // ========== ISSUES (contenedores de iniciativas competidoras) ==========
  // phase ∈ { admission, discussion, verification, voting, finished }
  // phaseStartAt es la fecha en que entró a la fase actual.
  const issues = [
    {
      id: 'iss_blockchain',
      title: 'Cadena pública para votación vinculante',
      celulaId: 'cel_ti',
      policyId: 'pol_constitutional',
      article: 12,
      phase: 'voting',
      phaseStartAt: daysAgo(2),
      createdAt: daysAgo(30),
      description: 'El Artículo 12 establece que las decisiones se votarán a través de una plataforma segura basada en blockchain. Esta issue resuelve qué tecnología adoptar — tres iniciativas competidoras en votación preferencial.',
    },
    {
      id: 'iss_moneda',
      title: 'Postura monetaria oficial del Partido',
      celulaId: 'cel_economia',
      policyId: 'pol_constitutional',
      article: 5,
      phase: 'discussion',
      phaseStartAt: daysAgo(8),
      createdAt: daysAgo(22),
      description: 'Pronunciamiento vinculante sobre la línea monetaria oficial. Afecta prensa, prospectos legislativos y alianzas. Tres propuestas en discusión paralela.',
    },
    {
      id: 'iss_emblema',
      title: 'Emblema y símbolos oficiales del PLC',
      celulaId: 'cel_propaganda',
      policyId: 'pol_standard',
      article: 1,
      phase: 'verification',
      phaseStartAt: daysAgo(1),
      createdAt: daysAgo(24),
      description: 'El Artículo 1 delega la definición del emblema a la Organización. Tres propuestas gráficas han superado el quórum de admisión; ahora se verifica soporte final antes del voto.',
    },
    {
      id: 'iss_onboarding',
      title: 'Procedimiento de incorporación de nuevos afiliados',
      celulaId: 'cel_rrhh',
      policyId: 'pol_standard',
      article: 17,
      phase: 'discussion',
      phaseStartAt: daysAgo(5),
      createdAt: daysAgo(12),
      description: 'Cómo se convierte un simpatizante en afiliado con derecho a voto. El sistema debe reconciliar la verificación de nacionalidad (Art. 9) con la arquitectura descentralizada del Partido.',
    },
    {
      id: 'iss_sede',
      title: 'Habilitación de sede provincial en La Habana',
      celulaId: 'cel_legal',
      policyId: 'pol_standard',
      article: 2,
      phase: 'admission',
      phaseStartAt: daysAgo(4),
      createdAt: daysAgo(4),
      description: 'Construir presencia legal en la isla sin comprometer la descentralización. Admisión abierta: busca apoyo suficiente para pasar a discusión formal.',
    },
    {
      id: 'iss_comunicacion',
      title: 'Plan de comunicación externa — Q2 2026',
      celulaId: 'cel_propaganda',
      policyId: 'pol_urgent',
      article: 18,
      phase: 'voting',
      phaseStartAt: daysAgo(0.5),
      createdAt: daysAgo(8),
      description: 'Ventana corta. Define posicionamiento externo para abril-junio. Dos iniciativas contrastadas: bajo ruido técnico vs. presencia digital agresiva.',
    },
    {
      id: 'iss_disciplina',
      title: 'Protocolo de debido proceso disciplinario',
      celulaId: 'cel_rrhh',
      policyId: 'pol_constitutional',
      article: 19,
      phase: 'admission',
      phaseStartAt: daysAgo(2),
      createdAt: daysAgo(2),
      description: 'Operativización del Artículo 19. Define acusación, apelación, publicidad del proceso y quórum especial para sanciones mayores.',
    },
    {
      id: 'iss_auditoria',
      title: 'Auditoría en tiempo real — libro contable Q1 2026',
      celulaId: 'cel_economia',
      policyId: 'pol_standard',
      article: 15,
      phase: 'finished',
      phaseStartAt: daysAgo(15),
      createdAt: daysAgo(40),
      description: 'Implementación del principio de transparencia radical (Art. 12.4). Issue cerrada: ganó la propuesta de auditoría Merkle firmada en feed público.',
      winningInitiativeId: 'ini_audit_merkle',
    },
  ];

  // ========== INITIATIVES (propuestas concretas, varias por issue) ==========
  const initiatives = [
    // iss_blockchain — 3 competidoras
    { id: 'ini_bc_l2',       issueId: 'iss_blockchain', authorId: 'af_010', title: 'Optimism/Base como L2 de Ethereum',
      summary: 'Contratos en Solidity sobre una L2 madura. Costo marginal < $0.01, finalidad sub-minuto, ecosistema amplio.', createdAt: daysAgo(28) },
    { id: 'ini_bc_btc',      issueId: 'iss_blockchain', authorId: 'af_002', title: 'Bitcoin + sidechain firmada',
      summary: 'Raíz en Bitcoin (máxima resistencia), contratos en sidechain compatible. Prioridad: censorship-resistance.', createdAt: daysAgo(27) },
    { id: 'ini_bc_soberana', issueId: 'iss_blockchain', authorId: 'af_006', title: 'Cadena soberana cubana-libertaria',
      summary: 'Construir una cadena propia operada por afiliados. Más control, menos adopción, más responsabilidad operacional.', createdAt: daysAgo(24) },

    // iss_moneda — 3
    { id: 'ini_mon_dolar',   issueId: 'iss_moneda', authorId: 'af_003', title: 'Dolarización total oficial',
      summary: 'Adopción del dólar estadounidense como moneda única. Simple, probado (Panamá, Ecuador), anula el BCC.', createdAt: daysAgo(20) },
    { id: 'ini_mon_hayek',   issueId: 'iss_moneda', authorId: 'af_004', title: 'Competencia monetaria libre (Hayek)',
      summary: 'Abolición del curso legal forzoso. Cualquier medio de pago circula (USD, EUR, BTC, oro, monedas privadas). El mercado elige.', createdAt: daysAgo(18) },
    { id: 'ini_mon_bitcoin', issueId: 'iss_moneda', authorId: 'af_010', title: 'Bitcoin como reserva oficial',
      summary: 'Combinación: USD como moneda de transacción, Bitcoin en balance soberano. Resistencia a inflación estadounidense.', createdAt: daysAgo(15) },

    // iss_emblema — 3
    { id: 'ini_emb_tipo',  issueId: 'iss_emblema', authorId: 'af_011', title: 'Tipográfico puro',
      summary: 'Letra P con corte diagonal, acento amarillo. Máxima legibilidad en pequeño, reproducción trivial.', createdAt: daysAgo(22) },
    { id: 'ini_emb_escudo', issueId: 'iss_emblema', authorId: 'af_005', title: 'Escudo minimalista',
      summary: 'Contorno de Cuba estilizado, estrella solitaria desplazada. Evoca identidad nacional sin apropiación partidista.', createdAt: daysAgo(20) },
    { id: 'ini_emb_geometrico', issueId: 'iss_emblema', authorId: 'af_001', title: 'Motivo geométrico libertario',
      summary: 'Hexágono con tres vértices destacados (vida, libertad, propiedad). Neutro, ninguna referencia nacionalista.', createdAt: daysAgo(18) },

    // iss_onboarding — 2
    { id: 'ini_onb_cripto', issueId: 'iss_onboarding', authorId: 'af_007', title: 'Clave criptográfica + verificación documental',
      summary: 'Tres pasos: aceptación firmada de la Carta, prueba de nacionalidad, emisión de clave personal desvinculada de identidad estatal.', createdAt: daysAgo(10) },
    { id: 'ini_onb_web',    issueId: 'iss_onboarding', authorId: 'af_006', title: 'Red de confianza (web of trust)',
      summary: 'Tres afiliados existentes avalan al nuevo. No requiere documentos estatales. Resiste infiltración a través del grafo social.', createdAt: daysAgo(8) },

    // iss_sede — 2
    { id: 'ini_sede_asoc',    issueId: 'iss_sede', authorId: 'af_004', title: 'Asociación civil registrada',
      summary: 'Registro legal formal bajo marco cubano vigente. Riesgo: intervención estatal. Beneficio: cuenta bancaria, contratos, empleados.', createdAt: daysAgo(3) },
    { id: 'ini_sede_informal', issueId: 'iss_sede', authorId: 'af_001', title: 'Operación informal descentralizada',
      summary: 'Ninguna entidad legal expuesta. Coordinación por célula, infraestructura digital. Resiliencia vs. legitimidad.', createdAt: daysAgo(2) },

    // iss_comunicacion — 2
    { id: 'ini_com_traduccion', issueId: 'iss_comunicacion', authorId: 'af_005', title: 'Traducciones + bucles de retroalimentación',
      summary: 'Manifiesto a inglés y francés, métricas públicas de sentimiento, acuerdos con medios independientes sin ceder control editorial.', createdAt: daysAgo(6) },
    { id: 'ini_com_agresivo',   issueId: 'iss_comunicacion', authorId: 'af_011', title: 'Presencia digital agresiva',
      summary: 'Meme warfare, contenido viral, influencers libertarios, confrontación directa con el discurso régimen en tiempo real.', createdAt: daysAgo(5) },

    // iss_disciplina — 2
    { id: 'ini_disc_proceso', issueId: 'iss_disciplina', authorId: 'af_008', title: 'Debido proceso con apelación pública',
      summary: 'Acusación firmada, respuesta pública, evidencia auditada, decisión razonada publicada en bitácora. Todo sobre la mesa.', createdAt: daysAgo(2) },
    { id: 'ini_disc_mediacion', issueId: 'iss_disciplina', authorId: 'af_007', title: 'Mediación obligatoria pre-expulsión',
      summary: 'Antes de cualquier sanción mayor, ciclo de mediación 14d. Prioriza reconciliación sobre castigo.', createdAt: daysAgo(1) },

    // iss_auditoria (cerrada) — ganadora + perdedora
    { id: 'ini_audit_merkle', issueId: 'iss_auditoria', authorId: 'af_003', title: 'Feed Merkle firmado en registro público',
      summary: 'Cada entrada contable es un evento firmado, encadenado hashing-Merkle. Verificable con una línea de código.', createdAt: daysAgo(38) },
    { id: 'ini_audit_report', issueId: 'iss_auditoria', authorId: 'af_007', title: 'Informe trimestral con auditor externo',
      summary: 'Firma de Big Four o independiente. Más credibilidad institucional, menos transparencia en tiempo real.', createdAt: daysAgo(35) },
  ];

  // ========== DRAFTS (historial de versiones — mínimo 1 por iniciativa) ==========
  const drafts = initiatives.flatMap((i) => {
    const base = [{ id: randomUUID(), initiativeId: i.id, version: 1, authorId: i.authorId, createdAt: i.createdAt, content: i.summary }];
    // Algunas iniciativas tienen revisión
    if (['ini_bc_l2', 'ini_mon_dolar', 'ini_onb_cripto', 'ini_audit_merkle'].includes(i.id)) {
      base.push({
        id: randomUUID(), initiativeId: i.id, version: 2, authorId: i.authorId, createdAt: iso(new Date(new Date(i.createdAt).getTime() + 3 * 86400000)),
        content: i.summary + ' (Revisión v2: se añadió cláusula de auditoría y plan de migración.)'
      });
    }
    return base;
  });

  // ========== SUGGESTIONS (mejoras propuestas a iniciativas) ==========
  // directive ∈ { must, should, must_not, should_not }
  // plusRaters / minusRaters: arrays de affiliate IDs
  const suggestions = [
    // blockchain/L2
    { id: 'sug_001', initiativeId: 'ini_bc_l2',      authorId: 'af_006', directive: 'must',
      content: 'Añadir plan de migración a cadena soberana si la L2 fuese censurada.', createdAt: daysAgo(10), plusRaters: ['af_002','af_010','af_001'], minusRaters: [] },
    { id: 'sug_002', initiativeId: 'ini_bc_l2',      authorId: 'af_008', directive: 'should',
      content: 'Publicar costo mensual estimado en 3 escenarios de uso.', createdAt: daysAgo(7), plusRaters: ['af_003','af_007'], minusRaters: [] },
    { id: 'sug_003', initiativeId: 'ini_bc_btc',     authorId: 'af_010', directive: 'must_not',
      content: 'No depender de un operador centralizado de sidechain.', createdAt: daysAgo(9), plusRaters: ['af_002','af_006','af_004'], minusRaters: [] },
    { id: 'sug_004', initiativeId: 'ini_bc_soberana', authorId: 'af_002', directive: 'should',
      content: 'Presentar presupuesto anual operacional y plan de contingencia si la red cae.', createdAt: daysAgo(6), plusRaters: ['af_010','af_001','af_011'], minusRaters: ['af_006'] },

    // moneda
    { id: 'sug_005', initiativeId: 'ini_mon_dolar',  authorId: 'af_004', directive: 'must',
      content: 'Explicitar transición de 90 días con tipo de cambio piso para salarios CUP existentes.', createdAt: daysAgo(12), plusRaters: ['af_003','af_007','af_008','af_011'], minusRaters: [] },
    { id: 'sug_006', initiativeId: 'ini_mon_hayek',  authorId: 'af_003', directive: 'should',
      content: 'Definir régimen fiscal cuando coexisten 5+ monedas — riesgo de evasión.', createdAt: daysAgo(10), plusRaters: ['af_008'], minusRaters: ['af_004','af_010'] },
    { id: 'sug_007', initiativeId: 'ini_mon_bitcoin', authorId: 'af_003', directive: 'should_not',
      content: 'No convertir reservas USD a BTC de golpe — riesgo de volatilidad macro en transición.', createdAt: daysAgo(9), plusRaters: ['af_004','af_007','af_001'], minusRaters: ['af_010'] },

    // emblema
    { id: 'sug_008', initiativeId: 'ini_emb_tipo',   authorId: 'af_005', directive: 'must',
      content: 'Incluir versión de 16×16 px con alto contraste para favicon y redes.', createdAt: daysAgo(15), plusRaters: ['af_011','af_001','af_007'], minusRaters: [] },
    { id: 'sug_009', initiativeId: 'ini_emb_escudo', authorId: 'af_011', directive: 'must_not',
      content: 'Evitar cualquier apropiación del escudo del régimen cubano actual.', createdAt: daysAgo(13), plusRaters: ['af_004','af_005','af_001','af_008'], minusRaters: [] },

    // onboarding
    { id: 'sug_010', initiativeId: 'ini_onb_cripto', authorId: 'af_010', directive: 'must',
      content: 'La clave personal debe almacenarse sólo localmente; el Partido no la custodia.', createdAt: daysAgo(7), plusRaters: ['af_006','af_002','af_007','af_003','af_001'], minusRaters: [] },
    { id: 'sug_011', initiativeId: 'ini_onb_web',    authorId: 'af_007', directive: 'should',
      content: 'Limitar el grado de avales por afiliado para evitar colusión.', createdAt: daysAgo(5), plusRaters: ['af_006'], minusRaters: [] },

    // comunicación
    { id: 'sug_012', initiativeId: 'ini_com_agresivo', authorId: 'af_004', directive: 'should_not',
      content: 'No adoptar estética meme que comprometa el tono institucional del Manifiesto.', createdAt: daysAgo(4), plusRaters: ['af_003','af_005','af_007'], minusRaters: ['af_011','af_002'] },

    // disciplina
    { id: 'sug_013', initiativeId: 'ini_disc_proceso', authorId: 'af_004', directive: 'must',
      content: 'Publicación anonimizada del acusado si no es figura pública del Partido.', createdAt: daysAgo(1), plusRaters: ['af_007','af_008','af_005'], minusRaters: ['af_001'] },
  ];

  // ========== SUPPORTERS (apoyo pre-voto / endorsement) ==========
  // (affiliateId, initiativeId, potential)
  // potential=true significa "apoyo condicional" (si suggestion marcada must se cumple)
  const supports = [
    // iss_blockchain (voting → consolidated support)
    { affiliateId: 'af_010', initiativeId: 'ini_bc_l2',       at: daysAgo(25), potential: false },
    { affiliateId: 'af_002', initiativeId: 'ini_bc_l2',       at: daysAgo(24), potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_bc_l2',       at: daysAgo(20), potential: false },
    { affiliateId: 'af_007', initiativeId: 'ini_bc_l2',       at: daysAgo(18), potential: false },
    { affiliateId: 'af_011', initiativeId: 'ini_bc_l2',       at: daysAgo(10), potential: false },
    { affiliateId: 'af_003', initiativeId: 'ini_bc_l2',       at: daysAgo(8),  potential: true },
    { affiliateId: 'af_002', initiativeId: 'ini_bc_btc',      at: daysAgo(22), potential: false },
    { affiliateId: 'af_006', initiativeId: 'ini_bc_btc',      at: daysAgo(20), potential: false },
    { affiliateId: 'af_010', initiativeId: 'ini_bc_btc',      at: daysAgo(15), potential: true },
    { affiliateId: 'af_006', initiativeId: 'ini_bc_soberana', at: daysAgo(21), potential: false },
    { affiliateId: 'af_008', initiativeId: 'ini_bc_soberana', at: daysAgo(17), potential: false },

    // iss_moneda
    { affiliateId: 'af_003', initiativeId: 'ini_mon_dolar',   at: daysAgo(18), potential: false },
    { affiliateId: 'af_004', initiativeId: 'ini_mon_dolar',   at: daysAgo(15), potential: false },
    { affiliateId: 'af_007', initiativeId: 'ini_mon_dolar',   at: daysAgo(10), potential: false },
    { affiliateId: 'af_008', initiativeId: 'ini_mon_dolar',   at: daysAgo(7),  potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_mon_dolar',   at: daysAgo(5),  potential: false },
    { affiliateId: 'af_011', initiativeId: 'ini_mon_dolar',   at: daysAgo(3),  potential: true },
    { affiliateId: 'af_004', initiativeId: 'ini_mon_hayek',   at: daysAgo(16), potential: false },
    { affiliateId: 'af_006', initiativeId: 'ini_mon_hayek',   at: daysAgo(12), potential: false },
    { affiliateId: 'af_002', initiativeId: 'ini_mon_hayek',   at: daysAgo(9),  potential: false },
    { affiliateId: 'af_010', initiativeId: 'ini_mon_bitcoin', at: daysAgo(12), potential: false },
    { affiliateId: 'af_002', initiativeId: 'ini_mon_bitcoin', at: daysAgo(8),  potential: true },

    // iss_emblema (verification → debe pasar quórum por iniciativa)
    { affiliateId: 'af_011', initiativeId: 'ini_emb_tipo',       at: daysAgo(20), potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_emb_tipo',       at: daysAgo(18), potential: false },
    { affiliateId: 'af_005', initiativeId: 'ini_emb_tipo',       at: daysAgo(10), potential: false },
    { affiliateId: 'af_007', initiativeId: 'ini_emb_tipo',       at: daysAgo(6),  potential: false },
    { affiliateId: 'af_005', initiativeId: 'ini_emb_escudo',     at: daysAgo(18), potential: false },
    { affiliateId: 'af_004', initiativeId: 'ini_emb_escudo',     at: daysAgo(12), potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_emb_geometrico', at: daysAgo(16), potential: false },
    { affiliateId: 'af_008', initiativeId: 'ini_emb_geometrico', at: daysAgo(11), potential: false },

    // iss_onboarding (discussion)
    { affiliateId: 'af_007', initiativeId: 'ini_onb_cripto', at: daysAgo(9),  potential: false },
    { affiliateId: 'af_010', initiativeId: 'ini_onb_cripto', at: daysAgo(8),  potential: false },
    { affiliateId: 'af_006', initiativeId: 'ini_onb_cripto', at: daysAgo(6),  potential: false },
    { affiliateId: 'af_002', initiativeId: 'ini_onb_cripto', at: daysAgo(4),  potential: false },
    { affiliateId: 'af_006', initiativeId: 'ini_onb_web',    at: daysAgo(7),  potential: false },
    { affiliateId: 'af_009', initiativeId: 'ini_onb_web',    at: daysAgo(3),  potential: false },

    // iss_sede (admission — busca llegar al quórum)
    { affiliateId: 'af_004', initiativeId: 'ini_sede_asoc',    at: daysAgo(3), potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_sede_informal', at: daysAgo(1), potential: false },
    { affiliateId: 'af_006', initiativeId: 'ini_sede_informal', at: daysAgo(1), potential: false },

    // iss_comunicacion (voting)
    { affiliateId: 'af_005', initiativeId: 'ini_com_traduccion', at: daysAgo(5), potential: false },
    { affiliateId: 'af_004', initiativeId: 'ini_com_traduccion', at: daysAgo(4), potential: false },
    { affiliateId: 'af_011', initiativeId: 'ini_com_agresivo',   at: daysAgo(4), potential: false },

    // iss_disciplina (admission)
    { affiliateId: 'af_008', initiativeId: 'ini_disc_proceso',    at: daysAgo(2), potential: false },
    { affiliateId: 'af_004', initiativeId: 'ini_disc_proceso',    at: daysAgo(1), potential: false },
    { affiliateId: 'af_007', initiativeId: 'ini_disc_mediacion',  at: daysAgo(1), potential: false },

    // iss_auditoria (finished)
    { affiliateId: 'af_003', initiativeId: 'ini_audit_merkle',   at: daysAgo(38), potential: false },
    { affiliateId: 'af_010', initiativeId: 'ini_audit_merkle',   at: daysAgo(36), potential: false },
    { affiliateId: 'af_001', initiativeId: 'ini_audit_merkle',   at: daysAgo(30), potential: false },
    { affiliateId: 'af_007', initiativeId: 'ini_audit_report',   at: daysAgo(32), potential: false },
  ];

  // ========== VOTES (ballots preferenciales por issue) ==========
  // cada ballot: { affiliateId, issueId, rankings }
  // rankings: mapa initiativeId → tier (1 = mejor; mayor = peor; status quo implícito en el umbral)
  // approve: rank <= statusQuoRank; disapprove: rank > statusQuoRank
  // Para simplificar: statusQuo siempre es rank=99 (todo lo rankeado <= N es aprobado)
  const ballots = [
    // iss_blockchain (voting)
    { affiliateId: 'af_010', issueId: 'iss_blockchain', at: daysAgo(1), rankings: { 'ini_bc_l2': 1, 'ini_bc_btc': 2, 'ini_bc_soberana': 3 } },
    { affiliateId: 'af_002', issueId: 'iss_blockchain', at: daysAgo(1), rankings: { 'ini_bc_l2': 1, 'ini_bc_btc': 1, 'ini_bc_soberana': 4 } },
    { affiliateId: 'af_006', issueId: 'iss_blockchain', at: daysAgo(0.8), rankings: { 'ini_bc_soberana': 1, 'ini_bc_btc': 2, 'ini_bc_l2': 3 } },
    { affiliateId: 'af_003', issueId: 'iss_blockchain', at: daysAgo(0.5), rankings: { 'ini_bc_l2': 1, 'ini_bc_btc': 2, 'ini_bc_soberana': 2 } },
    { affiliateId: 'af_004', issueId: 'iss_blockchain', at: daysAgo(0.3), rankings: { 'ini_bc_l2': 1, 'ini_bc_btc': 3, 'ini_bc_soberana': 4 } },
    { affiliateId: 'af_001', issueId: 'iss_blockchain', at: daysAgo(0.2), rankings: { 'ini_bc_l2': 1, 'ini_bc_btc': 2, 'ini_bc_soberana': 3 } },

    // iss_comunicacion (voting)
    { affiliateId: 'af_005', issueId: 'iss_comunicacion', at: daysAgo(0.3), rankings: { 'ini_com_traduccion': 1, 'ini_com_agresivo': 3 } },
    { affiliateId: 'af_004', issueId: 'iss_comunicacion', at: daysAgo(0.3), rankings: { 'ini_com_traduccion': 1, 'ini_com_agresivo': 4 } },
    { affiliateId: 'af_011', issueId: 'iss_comunicacion', at: daysAgo(0.2), rankings: { 'ini_com_agresivo': 1, 'ini_com_traduccion': 2 } },

    // iss_auditoria (finished)
    { affiliateId: 'af_003', issueId: 'iss_auditoria', at: daysAgo(16), rankings: { 'ini_audit_merkle': 1, 'ini_audit_report': 3 } },
    { affiliateId: 'af_010', issueId: 'iss_auditoria', at: daysAgo(16), rankings: { 'ini_audit_merkle': 1, 'ini_audit_report': 4 } },
    { affiliateId: 'af_001', issueId: 'iss_auditoria', at: daysAgo(15), rankings: { 'ini_audit_merkle': 1, 'ini_audit_report': 2 } },
    { affiliateId: 'af_007', issueId: 'iss_auditoria', at: daysAgo(15), rankings: { 'ini_audit_report': 1, 'ini_audit_merkle': 2 } },
    { affiliateId: 'af_004', issueId: 'iss_auditoria', at: daysAgo(15), rankings: { 'ini_audit_merkle': 1, 'ini_audit_report': 3 } },
  ];

  // ========== DELEGATIONS (scope: global | celula | issue) ==========
  const delegations = [
    { id: randomUUID(), from: 'af_009', to: 'af_001', scope: 'global', targetId: null,             createdAt: daysAgo(60), revokedAt: null },
    { id: randomUUID(), from: 'af_012', to: 'af_003', scope: 'celula', targetId: 'cel_economia',   createdAt: daysAgo(50), revokedAt: null },
    { id: randomUUID(), from: 'af_008', to: 'af_006', scope: 'celula', targetId: 'cel_ti',         createdAt: daysAgo(48), revokedAt: null },
    { id: randomUUID(), from: 'af_005', to: 'af_004', scope: 'celula', targetId: 'cel_legal',      createdAt: daysAgo(45), revokedAt: null },
    { id: randomUUID(), from: 'af_009', to: 'af_003', scope: 'celula', targetId: 'cel_economia',   createdAt: daysAgo(32), revokedAt: null },
    { id: randomUUID(), from: 'af_011', to: 'af_005', scope: 'celula', targetId: 'cel_propaganda', createdAt: daysAgo(40), revokedAt: null },
    { id: randomUUID(), from: 'af_007', to: 'af_010', scope: 'issue',  targetId: 'iss_blockchain', createdAt: daysAgo(28), revokedAt: null },
  ];

  // ========== AUDIT ==========
  const audit = [
    { id: randomUUID(), at: daysAgo(0.1),  kind: 'voto',              actor: 'af_001', target: 'iss_blockchain', meta: { issue: 'iss_blockchain' } },
    { id: randomUUID(), at: daysAgo(0.2),  kind: 'voto',              actor: 'af_011', target: 'iss_comunicacion', meta: { issue: 'iss_comunicacion' } },
    { id: randomUUID(), at: daysAgo(0.5),  kind: 'voto',              actor: 'af_004', target: 'iss_blockchain', meta: {} },
    { id: randomUUID(), at: daysAgo(1),    kind: 'fase_cambio',       actor: 'sistema', target: 'iss_blockchain', meta: { from: 'verification', to: 'voting' } },
    { id: randomUUID(), at: daysAgo(1),    kind: 'fase_cambio',       actor: 'sistema', target: 'iss_emblema',    meta: { from: 'discussion', to: 'verification' } },
    { id: randomUUID(), at: daysAgo(2),    kind: 'sugerencia',        actor: 'af_008', target: 'ini_disc_proceso', meta: { directive: 'must' } },
    { id: randomUUID(), at: daysAgo(2),    kind: 'iniciativa_nueva', actor: 'af_008', target: 'ini_disc_proceso', meta: { title: 'Debido proceso...' } },
    { id: randomUUID(), at: daysAgo(3),    kind: 'apoyo',             actor: 'af_006', target: 'ini_sede_informal', meta: {} },
    { id: randomUUID(), at: daysAgo(4),    kind: 'issue_nueva',       actor: 'af_004', target: 'iss_sede', meta: { title: 'Sede provincial La Habana' } },
    { id: randomUUID(), at: daysAgo(5),    kind: 'delegacion',        actor: 'af_009', target: 'af_003', meta: { scope: 'celula', targetId: 'cel_economia' } },
    { id: randomUUID(), at: daysAgo(8),    kind: 'fase_cambio',       actor: 'sistema', target: 'iss_moneda', meta: { from: 'admission', to: 'discussion' } },
    { id: randomUUID(), at: daysAgo(10),   kind: 'sugerencia',        actor: 'af_010', target: 'ini_onb_cripto', meta: { directive: 'must' } },
    { id: randomUUID(), at: daysAgo(15),   kind: 'fase_cambio',       actor: 'sistema', target: 'iss_auditoria', meta: { from: 'voting', to: 'finished' } },
    { id: randomUUID(), at: daysAgo(15),   kind: 'voto',              actor: 'af_004', target: 'iss_auditoria', meta: {} },
  ];

  const meta = {
    org: unit.name,
    acronym: unit.acronym,
    platform: 'Ágora Digital',
    version: 'LF-PLC v0.2',
    founded: 'Florida, EE.UU.',
    principle: 'La soberanía reside enteramente en el individuo.',
    article20: 'El contenido de la CARTA DE PRINCIPIOS Y ESTATUTOS ORGÁNICOS es inmutable.',
    currentAffiliate: 'af_001',
    genesis: unit.foundedAt,
  };

  return { meta, unit, policies, celulas, affiliates, issues, initiatives, drafts, suggestions, supports, ballots, delegations, audit };
}
