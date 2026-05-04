// The Carta de Principios — rendered from the source document.
// Each title is a group; each article is a node.

export const CARTA = {
  preambulo: {
    label: 'Preámbulo',
    heading: 'Un sistema vivo, propio para la libertad.',
    body: `El Partido Libertario de Cuba se constituye para defender la vida, la libertad y la propiedad de todos los cubanos e individuos del mundo. Sostenemos que el individuo es anterior y superior al Estado, y nos comprometemos a desmantelar el totalitarismo mediante la promoción del libre mercado, la propiedad privada y límites estrictos al poder gubernamental desde una organización descentralizada y basada en redes donde la soberanía reside enteramente en el individuo.`,
  },
  titulos: [
    {
      roman: 'I',
      name: 'Constitución y naturaleza',
      articulos: [
        { n: 1, title: 'Designación y naturaleza',
          body: `<p>La organización se denomina <strong>Partido Libertario de Cuba</strong>. Su emblema y símbolos serán regulados por la Organización.</p>`,
          live: { type: 'initiative', ref: 'ini_emblema' } },
        { n: 2, title: 'Domicilio legal',
          body: `<p>El domicilio legal del Partido se establece en Florida, Estados Unidos de América; sin perjuicio del establecimiento de sedes provinciales en toda la República de Cuba y/o en el exilio.</p>`,
          live: { type: 'initiative', ref: 'ini_sede' } },
        { n: 3, title: 'Objeto y naturaleza instrumental',
          body: `<p>Esta Acta regula la organización y los procesos de toma de decisiones del Partido. La estructura del Partido sirve únicamente como vehículo para implementar los principios de la libertad. <em>Cualquier acto de las autoridades del partido que contradiga la voluntad de los afiliados expresada a través de los sistemas de democracia aquí definidos será nulo y sin valor.</em></p>` },
      ],
    },
    {
      roman: 'II',
      name: 'Declaración de principios',
      articulos: [
        { n: 4, title: 'Derechos fundamentales',
          body: `<p>El Partido afirma los siguientes derechos inmutables:</p>
                 <ol>
                   <li><strong>Autopropiedad vital.</strong> Todo ser humano es el único dueño de su vida, su cuerpo y su mente.</li>
                   <li><strong>Propiedad.</strong> El derecho a la propiedad es una extensión del derecho a la vida. Defendemos el derecho de los individuos a poseer, comerciar y heredar propiedades sin interferencia del Estado.</li>
                   <li><strong>No Agresión.</strong> Nos oponemos a la iniciación de cualquier tipo de violencia injustificada contra otros para lograr objetivos políticos o sociales.</li>
                 </ol>` },
        { n: 5, title: 'Libertad económica',
          body: `<p>Abogamos por una economía de libre mercado, la eliminación de los controles de precios, la abolición de los monopolios estatales y el derecho irrestricto de los cubanos a participar en el comercio y el intercambio voluntario de cualquier naturaleza, con el único y exclusivo límite de los principios declarados en esta Acta.</p>`,
          live: { type: 'initiative', ref: 'ini_dolarizacion' } },
        { n: 6, title: 'Autodefensa',
          body: `<p>Dado que el medio último de ejercicio de la ley y los derechos es la coacción violenta, bajo ninguna circunstancia se infringirán los derechos individuales a poseer, portar, comercializar o interactuar con armas en cualquier otra forma.</p>` },
      ],
    },
    {
      roman: 'III',
      name: 'Afiliación y membresía',
      articulos: [
        { n: 7, title: 'Categorías de membresía',
          body: `<p>El Partido reconoce dos categorías de participación:</p>
                 <ol>
                   <li><strong>Afiliados (Miembros).</strong> Nacionales, ciudadanos y/o residentes permanentes que se registran formalmente, aceptan esta Acta y tienen derecho a voto.</li>
                   <li><strong>Adherentes (Simpatizantes).</strong> Individuos que simpatizan con el Partido y contribuyen a su causa pero no poseen derechos de voto ni afiliación formal.</li>
                 </ol>` },
        { n: 8, title: 'Derechos de los afiliados',
          body: `<p>Los afiliados tienen derecho a:</p>
                 <ol>
                   <li>Participar en la Organización con pleno derecho a voz y voto.</li>
                   <li>Participar en la plataforma de democracia líquida digital para dirigir la política del Partido.</li>
                 </ol>` },
        { n: 9, title: 'Obligaciones',
          body: `<p>Los afiliados deben:</p>
                 <ol>
                   <li>Ser nacionales cubanos, ciudadanos y/o residentes permanentes.</li>
                   <li>Cumplir con la presente Acta de Principios y Estatutos Orgánicos.</li>
                 </ol>`,
          live: { type: 'initiative', ref: 'ini_onboarding' } },
      ],
    },
    {
      roman: 'IV',
      name: 'Estructura organizativa',
      articulos: [
        { n: 10, title: 'Forma del Partido',
          body: `<p>La <strong>Organización</strong> es la autoridad suprema del Partido. No es un cuerpo representativo de unos pocos funcionarios electos, sino que se constituye como una red viva e interconectada, dirigida por las fuerzas del mercado. <em>Nadie tiene el control. Todos los afiliados están a cargo.</em> Como subgrupos de esta Organización, el Partido se compone de <strong>Células</strong> autónomas internas.</p>` },
        { n: 11, title: 'Función',
          body: `<p>La Organización:</p>
                 <ol>
                   <li>Determina las decisiones del Partido mediante democracia líquida.</li>
                   <li>Posee el poder de Veto sobre cualquier acción tomada por las Células.</li>
                 </ol>` },
        { n: 12, title: 'Sistema de gobernanza',
          body: `<p>El Partido implementa un sistema de &ldquo;Democracia Líquida&rdquo;. Las decisiones relativas a la política y la estrategia se votarán exclusivamente a través de una plataforma digital segura basada en blockchain.</p>
                 <ol>
                   <li><strong>Voto directo.</strong> Cada afiliado puede votar directamente sobre cualquier asunto.</li>
                   <li><strong>Delegación.</strong> Los afiliados pueden delegar su voto en otro afiliado de su elección para temas específicos y/o categorías de temas. Estos delegados también pueden delegar sus votos recibidos en otro afiliado, siempre que no sea propietario de un voto que ya posean. Las delegaciones son revocables con efecto inmediato.</li>
                   <li><strong>Naturaleza vinculante.</strong> Los resultados de las votaciones digitales son vinculantes para el Partido y, por tanto, para la Organización.</li>
                   <li>Todos los registros de votación (anonimizados donde sea necesario) y los libros contables financieros deben ser auditables en tiempo real por cualquier afiliado. El Partido se adhiere a un principio de transparencia radical.</li>
                 </ol>`,
          live: { type: 'multi', refs: ['ini_blockchain', 'ini_auditoria'] } },
      ],
    },
    {
      roman: 'V',
      name: 'Células internas',
      articulos: [
        { n: 13, title: 'Célula de Gestión',
          body: `<p><strong>Propósito.</strong> Facilitar los procesos y proyectos de la Organización, el funcionamiento interno de las Células y asegurar que el sistema en su conjunto apunte permanentemente a la mejora continua.</p>`,
          live: { type: 'celula', ref: 'cel_gestion' } },
        { n: 14, title: 'Célula Legal',
          body: `<p><strong>Propósito.</strong> Actuar como interfaz entre la estructura interna dinámica del Partido y los requisitos estáticos y rígidos de las leyes del Estado.</p>
                 <p><em>Función de Espejo:</em> esta Célula tiene cero iniciativa política. Estrictamente formaliza las decisiones tomadas por la Organización para satisfacer los requisitos legales externos.</p>`,
          live: { type: 'celula', ref: 'cel_legal' } },
        { n: 15, title: 'Célula Económica y Financiera',
          body: `<p><strong>Propósito.</strong> Gestionar el flujo de recursos necesarios para el funcionamiento de la Organización: contabilidad transparente de todas las contribuciones voluntarias, asignación de fondos basada estrictamente en el presupuesto aprobado, y garantía de robustez financiera frente a la incautación estatal o la inflación.</p>`,
          live: { type: 'celula', ref: 'cel_economia' } },
        { n: 16, title: 'Célula de TI e Infraestructura',
          body: `<p><strong>Propósito.</strong> Construir y mantener la infraestructura digital que hace posible el funcionamiento de la Organización: mantenimiento de la plataforma de votación de democracia líquida, ciberseguridad, y la exigencia de que el sistema sea auditable abiertamente en tiempo real.</p>`,
          live: { type: 'celula', ref: 'cel_ti' } },
        { n: 17, title: 'Célula de Recursos Humanos',
          body: `<p><strong>Propósito.</strong> Ser la instancia que optimiza todo lo relacionado con el elemento más importante de todo el Partido: <em>el individuo</em>. Incorporación, resolución de conflictos, acciones disciplinarias y gestión del talento humano.</p>`,
          live: { type: 'celula', ref: 'cel_rrhh' } },
        { n: 18, title: 'Célula de Propaganda y Comunicaciones',
          body: `<p><strong>Propósito.</strong> Amplificar la voz del Partido Libertario de Cuba en el entorno externo: difusión de la plataforma, relaciones con la prensa, bucles de retroalimentación para medir el sentimiento público y comunicación eficiente dentro del Partido.</p>`,
          live: { type: 'celula', ref: 'cel_propaganda' } },
      ],
    },
    {
      roman: 'VI',
      name: 'Acciones disciplinarias y enmienda de estatutos',
      articulos: [
        { n: 19, title: 'Disciplina',
          body: `<p>Los afiliados que violen el Principio de No Agresión, cometan fraude o actúen contra la Carta pueden ser sancionados por la Célula de Recursos Humanos. Las sanciones van desde la amonestación hasta la expulsión. El acusado tiene derecho al debido proceso y a la apelación.</p>`,
          live: { type: 'initiative', ref: 'ini_disciplina' } },
        { n: 20, title: 'Enmiendas',
          body: `<p>Los Estatutos contenidos en el presente documento, debido a su carácter fundacional tanto teórico, como práctico y técnico; <strong>no</strong> pueden ser enmendados, sujetos a modificaciones, eliminados ni ninguna acción similar. <em>El contenido de la Carta de Principios y Estatutos Orgánicos del PLC es inmutable.</em></p>` },
      ],
    },
  ],
};
