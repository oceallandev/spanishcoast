// SCP Network directory data
// - Edit this file to add/update Agencies, Agents, Developers, Developments, and Collaborators.
// - Names are treated as proper nouns (we avoid auto-translation on names in the UI).
// - Descriptions/bios can be auto-translated by the app if not provided per-language.

(() => {
  window.scpNetworkData = {
    version: '2026-02-15',
    agencies: [
      {
        id: 'agency_scp',
        slug: 'spanish-coast-properties',
        name: 'Spanish Coast Properties',
        headline: 'Concierge-style property, business, and vehicle deals in Costa Blanca South.',
        location: { town: 'Torrevieja', province: 'Alicante', costa: 'Costa Blanca South' },
        languages: ['en', 'es', 'ro', 'sv'],
        service_areas: ['Torrevieja', 'Orihuela Costa', 'Guardamar', 'Ciudad Quesada'],
        tags: ['Resale', 'New builds', 'Businesses', 'Vehicles', 'Management'],
        logo_url: 'assets/header-logo.png',
        cover_url: 'assets/placeholder.png',
        contacts: {
          phone: '+34624867866',
          whatsapp: '+34624867866',
          email: 'info@spanishcoastproperties.com',
          website: 'https://www.spanishcoastproperties.com'
        },
        verified: true,
        bio:
          'We operate like a concierge: shortlist first, then verify, coordinate, and keep the paperwork and handover clean. ' +
          'We also collaborate with local architects for licences/permits and compliance.'
      }
    ],
    agents: [
      {
        id: 'agent_adrian',
        slug: 'adrian',
        name: 'Adrian',
        headline: 'Property advisor and operations lead.',
        location: { town: 'Torrevieja', province: 'Alicante', costa: 'Costa Blanca South' },
        languages: ['en', 'es', 'ro', 'sv'],
        service_areas: ['Costa Blanca South'],
        tags: ['Resale', 'New builds', 'Negotiation', 'Paperwork'],
        photo_url: 'assets/placeholder.png',
        contacts: {
          phone: '+34624867866',
          whatsapp: '+34624867866',
          email: 'adrian@spanishcoastproperties.com'
        },
        agency_id: 'agency_scp',
        developer_id: null,
        verified: true,
        bio:
          'Practical, direct support from first viewing to keys. Clear next steps, fast answers, and realistic expectations.'
      },
      {
        id: 'agent_dev_sales',
        slug: 'newbuild-sales-team',
        name: 'New Build Sales Team',
        headline: 'Developer-side sales and viewing coordination.',
        location: { town: 'Orihuela', province: 'Alicante', costa: 'Costa Blanca South' },
        languages: ['en', 'es', 'sv'],
        service_areas: ['Costa Blanca South'],
        tags: ['Developments', 'Off-plan', 'Show house'],
        photo_url: 'assets/placeholder.png',
        contacts: { email: 'info@spanishcoastproperties.com' },
        agency_id: null,
        developer_id: 'dev_partner_1',
        verified: true,
        bio:
          'We coordinate developer visits and provide updated availability and pricing for selected developments.'
      }
    ],
    developers: [
      {
        id: 'dev_partner_1',
        slug: 'costa-blanca-developments',
        name: 'Costa Blanca Developments',
        headline: 'New build partner (Costa Blanca South).',
        location: { town: 'Orihuela Costa', province: 'Alicante', costa: 'Costa Blanca South' },
        languages: ['en', 'es', 'sv'],
        service_areas: ['Costa Blanca South'],
        tags: ['New builds', 'Key ready', 'Off-plan'],
        logo_url: 'assets/placeholder.png',
        contacts: { email: 'info@spanishcoastproperties.com' },
        verified: true,
        bio:
          'Developer profile placeholder. Replace this with your real developer partner details and their development list.'
      }
    ],
    developments: [
      {
        id: 'devm_p01939',
        slug: 'bigastro-townhouses-p01939',
        name: 'Bigastro Townhouses',
        headline: 'Boutique development: 2 townhouses with solarium + basement garage.',
        location: { town: 'Bigastro', province: 'Alicante', costa: 'Costa Blanca South' },
        developer_id: 'dev_partner_1',
        tags: ['Town house', 'New build', 'Pool', 'Solarium'],
        hero_url: 'assets/placeholder.png',
        verified: true,
        source_refs: {
          // Example mapping for REDSP v4:
          // <development_ref>P01939</development_ref>
          redsp: { development_ref: 'P01939' }
        },
        bio:
          'Example development profile mapped to a REDSP development ref (P01939). You can link this to imported new-build listings later.'
      }
    ],
    collaborators: [
      {
        id: 'col_architects',
        slug: 'licence-architect-partners',
        name: 'Licence and Architect Partners',
        kind: 'architects',
        headline: 'Licences, permits, and compliance in collaboration with architects.',
        location: { town: 'Costa Blanca South', province: 'Alicante', costa: 'Costa Blanca South' },
        languages: ['en', 'es'],
        service_areas: ['Costa Blanca South'],
        tags: ['Licences', 'Permits', 'Compliance'],
        logo_url: 'assets/placeholder.png',
        contacts: { email: 'info@spanishcoastproperties.com' },
        verified: true,
        bio:
          'We coordinate the licence workflow with trusted architects so clients get clear timelines, required documents, and the right technical scope.'
      }
    ]
  };
})();

