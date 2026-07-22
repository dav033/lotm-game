# Graph Report - .  (2026-07-21)

## Corpus Check
- 5 files · ~245,812 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1248 nodes · 3070 edges · 66 communities (58 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dependency Tree UI
- Card Builder App
- Element Diagnostics
- Data Export & Import
- Abilities Panel & State
- Game Ambient & Modals
- Seed Catalog Data
- Progression Simulator & Ritual Panel
- TypeScript Config Refs
- Phase Grouping
- Import Schemas
- Progression Slug Catalog
- Admin Advances Forms
- Abilities API & Domain
- Recipe Management
- Combine Domain Tests & Misc Pages
- Ritual API & DB Client
- Admin Server Actions
- Runtime Dependencies
- Dev Dependencies
- Admin CRUD Pages
- Admin Element & Recipe Forms
- Element Server Actions
- DB Closure & Progression Simulator Tests
- Achievement & Recipe Pending API
- Card Schema Definitions
- Admin Auth & Layout
- Game State Store
- Phase Seed & Progression Tests
- Combine API & Domain
- Advances Table & Actions
- Combine Types & Revelation Modal
- Project Docs & Rationale
- Achievement Admin Forms
- Card Export & Zip
- Drag & Recipe Pending UI
- Cards MCP Server
- npm Scripts
- Card Repository Extras
- Achievement Domain & Estado API
- Card Repository Core
- Combination Table UI
- Opencode MCP Config
- Cards HTTP Server
- Phase Rules Service
- Prisma Client & DB Fixtures
- Phase Completion & Achievements
- Discovery & Phase Availability
- Seed Content Docs
- Runtime Progression Replay
- Feature Gates
- Phase Rule Editor UI
- find-skills Doc
- App Layout & Navigation
- ESLint Config
- Package Metadata
- Admin Path Forms
- Cartas Page
- Tier Text Parser
- ESLint Legacy Config
- Next Config
- Prisma SQLite Adapter
- React DOM Types
- PostCSS Config
- Progression Catalog Slugs

## God Nodes (most connected - your core abstractions)
1. `exigirAdminPagina()` - 44 edges
2. `exigirAdminAccion()` - 40 edges
3. `sincronizarUmbralesFases()` - 33 edges
4. `combinarParaPerfil()` - 25 edges
5. `IconoElemento()` - 23 edges
6. `asegurarPerfil()` - 22 edges
7. `faseActualParaPerfil()` - 21 edges
8. `useJuegoStore` - 20 edges
9. `MapaFases()` - 19 edges
10. `buildRecipeInputKey()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `simulateProgression()` --indirect_call--> `ritual()`  [INFERRED]
  prisma/seed-content/progression-simulator.ts → src/server/domain/diagnostico.test.ts
- `loadGraphAndCounts()` --references--> `@prisma/client`  [EXTRACTED]
  prisma/seed-content/db-closure.test.ts → package.json
- `loadManagedSnapshot()` --references--> `@prisma/client`  [EXTRACTED]
  prisma/seed-content/db-closure.test.ts → package.json
- `combinarAvanceConSecuencia()` --references--> `@prisma/client`  [EXTRACTED]
  src/server/domain/combinar.ts → package.json
- `combinarParaPerfil()` --references--> `@prisma/client`  [EXTRACTED]
  src/server/domain/combinar.ts → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Layered game architecture (domain/services/actions/api/db)** — readme_src_server_domain, readme_src_server_services, readme_src_server_actions, readme_src_app_api, readme_src_server_db [EXTRACTED 1.00]
- **Seed content catalog pipeline** — prisma_seed_content_readme_elements_ts, prisma_seed_content_readme_sequences_ts, prisma_seed_content_readme_recipes_ts, prisma_seed_content_readme_advances_ts, prisma_seed_content_readme_rituals_ts, prisma_seed_content_readme_seed_data_ts, prisma_seed_content_readme_catalogs_test_ts [EXTRACTED 1.00]

## Communities (66 total, 8 thin omitted)

### Community 0 - "Dependency Tree UI"
Cohesion: 0.05
Nodes (78): PaginaArbolAdmin(), GET(), ArbolPestanas(), PESTANAS, CaminoEspina(), calcularDisposicion(), calcularDisposicionCamino(), Disposicion (+70 more)

### Community 1 - "Card Builder App"
Cohesion: 0.06
Nodes (47): App(), COVER_ACCENT, DEFAULT_STATE, labelFor(), newId(), normalizeState(), readFileAsDataURL(), Card (+39 more)

### Community 2 - "Element Diagnostics"
Cohesion: 0.08
Nodes (44): compararFilas(), PaginaDiagnostico(), tooltipParticipacion(), PaginaElementosAdmin(), colorDificultad(), ElementoVista, ExploradorElementos(), Filtros (+36 more)

### Community 3 - "Data Export & Import"
Cohesion: 0.08
Nodes (33): GET(), GET(), ImportadorDatos(), ejecutarImportacion(), parsear(), validarImportacion(), ImportDocumento, importDocumentoSchema (+25 more)

### Community 4 - "Abilities Panel & State"
Cohesion: 0.11
Nodes (26): aplicarDeltaAMemoria(), crearEstadoInteraccionHabilidades(), crearMemoriaAprendizVacia(), EstadoInteraccionHabilidades, EstadoMemoriaAprendiz, hayFacultadesDesbloqueadas(), ModoInteraccion, ResultadoVidente (+18 more)

### Community 5 - "Game Ambient & Modals"
Cohesion: 0.12
Nodes (24): Ambiente(), Avisos(), parPreviamenteFallido(), GhostArrastre(), Juego(), MesaCombinacion(), Receptaculo(), ModalAvanceFase() (+16 more)

### Community 6 - "Seed Catalog Data"
Cohesion: 0.14
Nodes (23): AdvanceSeed, getAdvanceDefinitions(), elements, elementSlugs, pathways, sequences, sequenceSlugs, ElementCategoryIds (+15 more)

### Community 7 - "Progression Simulator & Ritual Panel"
Cohesion: 0.10
Nodes (24): SimResult, PanelRituales(), render(), BloqueadoresElemento, calcularBloqueadoresMinimos(), calcularBloqueadoresRituales(), isBetter(), signature() (+16 more)

### Community 8 - "TypeScript Config Refs"
Cohesion: 0.06
Nodes (31): dom, dom.iterable, esnext, **/*.js, **/*.jsx, next-env.d.ts, .next/types/**/*.ts, .next-ui-review/types/**/*.ts (+23 more)

### Community 9 - "Phase Grouping"
Cohesion: 0.09
Nodes (23): agruparContenidoPorBloqueadores(), agruparElementosDeFase(), CandidatoInicial, compararCercaniaBloqueo(), ContenidoBloqueable, ElementoAgrupable, FaseAgrupable, filtrarCandidatosIniciales() (+15 more)

### Community 10 - "Import Schemas"
Cohesion: 0.07
Nodes (27): faseSchema, importAvanceSchema, importCaminoSchema, importCategoriaSchema, importDocumentCollections, importDocumentoV2Schema, importDocumentoV3Schema, importDocumentoV4Schema (+19 more)

### Community 11 - "Progression Slug Catalog"
Cohesion: 0.06
Nodes (30): ACUMULACION_BLOCK_NEW_SLUGS, ACUMULACION_CLOSURE_SLUGS, ERA_BLOCK_NEW_SLUGS, ERA_CLOSURE_SLUGS, ESFUERZO_BLOCK_NEW_SLUGS, ESFUERZO_CLOSURE_SLUGS, FINAL_SEQUENCE_SLUGS, HISTORIA_BLOCK_NEW_SLUGS (+22 more)

### Community 12 - "Admin Advances Forms"
Cohesion: 0.13
Nodes (17): PaginaEditarAvance(), PaginaNuevoAvance(), CampoElemento(), AvanceEditable, FormularioAvance(), OpcionElemento, OpcionSecuencia, CaminoEditable (+9 more)

### Community 13 - "Abilities API & Domain"
Cohesion: 0.17
Nodes (19): GET(), GET(), bodySchema, POST(), faseActualParaPerfil(), filtroElementoDisponiblePorPhaseIds(), ABILITY_KEYS, calcularPotencialPorElemento() (+11 more)

### Community 14 - "Recipe Management"
Cohesion: 0.15
Nodes (22): ConstructorReceta(), guardarSecuencia(), crearElementoDeSecuencia(), guardarReceta(), previsualizarReceta(), probarCombinacion(), RecetaCaminoFormData, RecetaOutputFormData (+14 more)

### Community 15 - "Combine Domain Tests & Misc Pages"
Cohesion: 0.13
Nodes (15): PaginaCombinacionesFallidas(), PaginaNuevaReceta(), inputKey, moneda, ojo, phase1, calcularRevisionMemoria(), CombinationStatRow (+7 more)

### Community 16 - "Ritual API & DB Client"
Cohesion: 0.13
Nodes (19): POST(), schema, Db, DbClient, globalForPrisma, PathwayUnlockUpsertArgs, phase, progressionPhase (+11 more)

### Community 17 - "Admin Server Actions"
Cohesion: 0.20
Nodes (24): MapaFases(), eliminarSecuencia(), guardarCamino(), alternarElementoActivo(), asignarElementosAFase(), assignmentSchema, condicionesSchema, eliminarFase() (+16 more)

### Community 18 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (25): better-sqlite3, framer-motion, html2canvas, jszip, lucide-react, @modelcontextprotocol/sdk, next, dependencies (+17 more)

### Community 19 - "Dev Dependencies"
Cohesion: 0.08
Nodes (25): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, prisma (+17 more)

### Community 20 - "Admin CRUD Pages"
Cohesion: 0.14
Nodes (14): PaginaAvancesAdmin(), PaginaCategoriasAdmin(), PaginaDatosAdmin(), PaginaEditarElemento(), PaginaNuevoElemento(), PaginaEditarLogro(), PaginaResumenAdmin(), PaginaEditarReceta() (+6 more)

### Community 21 - "Admin Element & Recipe Forms"
Cohesion: 0.19
Nodes (16): BuscadorElemento(), EASE_OUT_SNAPPY, Fila, FILA_MOTION, CreadorRapido(), ElementoEditable, SelectorDesencadenantes(), ElementoOpcion (+8 more)

### Community 22 - "Element Server Actions"
Cohesion: 0.15
Nodes (19): CATEGORIA_POR_TIPO, elementoEstaReferenciado(), eliminarElemento(), guardarElemento(), leerFormulario(), elementoRapidoSchema, elementoSchema, eliminarRecetasCompletamente() (+11 more)

### Community 23 - "DB Closure & Progression Simulator Tests"
Cohesion: 0.12
Nodes (15): managedTables, repoRoot, pickRandom(), recetaTieneDosUnidades(), SimAdvance, SimElement, SimInput, SimOptions (+7 more)

### Community 24 - "Achievement & Recipe Pending API"
Cohesion: 0.18
Nodes (15): POST(), schema, POST(), GET(), PaginaColeccion(), desbloqueoEspontaneoSatisfecho(), EspontaneoConfig, EspontaneoContexto (+7 more)

### Community 25 - "Card Schema Definitions"
Cohesion: 0.10
Nodes (18): ArtifactCardSchema, CardFilterSchema, CharacterCardSchema, CoverCardSchema, DEFAULT_BUILDER_STATE, FullImageCoverCardSchema, GeneralExplanationCardSchema, ImageSourceSchema (+10 more)

### Community 26 - "Admin Auth & Layout"
Cohesion: 0.19
Nodes (15): PaginaLoginAdmin(), AdminLayout(), SECCIONES, PaginaJuego(), loginAction(), loginSchema, logoutAction(), cerrarSesionAdmin() (+7 more)

### Community 27 - "Game State Store"
Cohesion: 0.13
Nodes (11): agregarAperturasBandeja(), Aviso, avisoTimers, crearInstanciaBandeja(), JuegoState, limitarPosicion(), OpcionesCombinacion, PendingRitualRisk (+3 more)

### Community 28 - "Phase Seed & Progression Tests"
Cohesion: 0.17
Nodes (13): BLOCKED_PHASE_FRONTIER_SLUGS, PHASE_2_AVAILABLE_SLUGS, PROGRESSION_PHASES, ProgressionPhaseSeed, DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS, PHASE1_CLOSURE_SLUGS, STARTER_SLUGS, advances (+5 more)

### Community 29 - "Combine API & Domain"
Cohesion: 0.24
Nodes (15): bodySchema, POST(), categoryPathOf(), combinarAvanceConSecuencia(), combinarParaPerfil(), CombinationError, apply(), createFixture() (+7 more)

### Community 30 - "Advances Table & Actions"
Cohesion: 0.20
Nodes (12): Filtros, FILTROS_INICIALES, TablaAvances(), useFiltros, alternarAvanceActivo(), eliminarAvance(), guardarAvance(), ingredientesDe() (+4 more)

### Community 31 - "Combine Types & Revelation Modal"
Cohesion: 0.14
Nodes (12): CombineResult, ELEMENT_TYPE_LABELS, ElementPublicData, ElementType, elementTypeSchema, PathwayReveal, ProgressionPhasePublicData, RecetaPendienteElemento (+4 more)

### Community 32 - "Project Docs & Rationale"
Cohesion: 0.16
Nodes (14): Rationale: each Server Action mutation independently revalidates the admin session, Admin Panel, Backup formats v2/v3/v4, /cartas route — card generator (previous app), Rationale: SQLite enters only via db.ts Prisma adapter so swapping to PostgreSQL doesn't touch game logic, Cards MCP server (stdio + Streamable HTTP), Rationale: phases are evaluated in order; an element reserved for a future phase cannot open it by itself, Phase advancement rule engine (fases/advancementRule) (+6 more)

### Community 33 - "Achievement Admin Forms"
Cohesion: 0.18
Nodes (9): PaginaNuevoLogro(), PaginaLogrosAdmin(), ElementOption, LogroEditable, SequenceOption, alternarLogroActivo(), eliminarLogro(), guardarLogro() (+1 more)

### Community 34 - "Card Export & Zip"
Cohesion: 0.23
Nodes (9): CardExportResult, createCardsZip(), exportCardsToZip(), RenderCard, resolveCardExportDir(), CardPngRenderer, CardContent, filenameForCard() (+1 more)

### Community 35 - "Drag & Recipe Pending UI"
Cohesion: 0.23
Nodes (11): permiteArrastre(), RecetasPendientes(), DestinoArrastre, EstadoJuego, OrigenArrastre, PayloadArrastre, posicionarGhost(), posicionRelativa() (+3 more)

### Community 36 - "Cards MCP Server"
Cohesion: 0.21
Nodes (10): repository, server, cardSummary(), createCardsMcpServer(), McpOptions, runTool(), DeleteCardsSchema, ExportCardsSchema (+2 more)

### Community 37 - "npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, cards:browser, cards:mcp, cards:mcp:http, db:deploy, db:migrate, db:seed (+5 more)

### Community 38 - "Card Repository Extras"
Cohesion: 0.22
Nodes (9): storedCard(), CardLibrary, JoinedCardRow, PartRow, StoredCard, UniverseRow, SaveCardBatchInput, SaveCardBatchSchema (+1 more)

### Community 39 - "Achievement Domain & Estado API"
Cohesion: 0.36
Nodes (8): GET(), PaginaLogros(), obtenerLogrosPendientes(), reconciliarLogros(), toPublicAchievement(), sequenceLabelOf(), toPublicAdvance(), toPublicElement()

### Community 40 - "Card Repository Core"
Cohesion: 0.26
Nodes (4): CardRepository, mapCard(), CardContentSchema, CardFilter

### Community 41 - "Combination Table UI"
Cohesion: 0.20
Nodes (6): BandejaPreparacion(), ElementoBandeja(), IniciarArrastre, GLIFOS_ORBITA, IniciarArrastre, Particulas()

### Community 42 - "Opencode MCP Config"
Cohesion: 0.18
Nodes (10): command, enabled, type, tsx, mcp, cards, $schema, --import (+2 more)

### Community 43 - "Cards HTTP Server"
Cohesion: 0.20
Nodes (8): allowedHosts, app, httpServer, localHosts, port, repository, shutdown(), shutdown()

### Community 44 - "Phase Rules Service"
Cohesion: 0.24
Nodes (6): calcularPertenenciaFasesPorAlcance(), calcularUmbralesDesdeSim(), EntradaPertenenciaFase, PertenenciaFasePorAlcance, fasesAnalisis, simInput

### Community 45 - "Prisma Client & DB Fixtures"
Cohesion: 0.31
Nodes (8): @prisma/client, @prisma/client, loadGraphAndCounts(), loadManagedSnapshot(), openingPhaseSlugForElement(), fusionarPercepcionEspiritualTypo(), seedGameData(), main()

### Community 46 - "Phase Completion & Achievements"
Cohesion: 0.33
Nodes (6): POST(), schema, completarFaseActual(), CompletePhaseError, CompletePhaseErrorCode, simularCierreHastaFase()

### Community 47 - "Discovery & Phase Availability"
Cohesion: 0.33
Nodes (7): elementoDisponibleEnFase(), ElementWithPhase, PhaseAvailability, phaseOrderAtDiscoveryCount(), resolverFasePorDescubrimientos(), phases, evaluatePhaseRule()

### Community 48 - "Seed Content Docs"
Cohesion: 0.61
Nodes (8): advances.ts, catalogs.test.ts, seed-content catalogs README, elements.ts, recipes.ts, rituals.ts, ../seed-data.ts (Prisma ops, migrations, write order), sequences.ts

### Community 49 - "Runtime Progression Replay"
Cohesion: 0.39
Nodes (7): difference(), replayRuntimeProgression(), RuntimeReplayResult, RuntimeReplayStep, sameSet(), snapshot(), advanceToken()

### Community 50 - "Feature Gates"
Cohesion: 0.29
Nodes (6): FEATURE_DEFINITIONS, FEATURE_KEYS, FeatureKey, FeatureState, resolveFeatureState(), key()

### Community 51 - "Phase Rule Editor UI"
Cohesion: 0.33
Nodes (6): defaultRule(), EditorReglaFase(), ElementOption, RULE_TYPES, RuleNodeEditor(), RuleType

### Community 52 - "find-skills Doc"
Cohesion: 0.47
Nodes (6): anthropics/skills, ComposioHQ/awesome-claude-skills, find-skills Skill Doc, Skills CLI (npx skills), skills.sh Leaderboard, vercel-labs/agent-skills

### Community 53 - "App Layout & Navigation"
Cohesion: 0.40
Nodes (3): metadata, ENLACES, NavPrincipal()

### Community 54 - "ESLint Config"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 55 - "Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 56 - "Admin Path Forms"
Cohesion: 0.50
Nodes (3): PaginaCaminosAdmin(), FormularioCamino(), FormularioSecuencia()

## Knowledge Gaps
- **373 isolated node(s):** `port`, `localHosts`, `allowedHosts`, `app`, `repository` (+368 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependencies` to `Prisma Client & DB Fixtures`, `Prisma SQLite Adapter`, `Package Metadata`?**
  _High betweenness centrality (0.280) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `Prisma Client & DB Fixtures` to `Data Export & Import`, `Abilities API & Domain`, `Phase Completion & Achievements`, `Recipe Management`, `Runtime Dependencies`, `Combine API & Domain`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `jszip` connect `Runtime Dependencies` to `Card Builder App`, `Card Export & Zip`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **What connects `port`, `localHosts`, `allowedHosts` to the rest of the system?**
  _373 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dependency Tree UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05222286934575811 - nodes in this community are weakly interconnected._
- **Should `Card Builder App` be split into smaller, more focused modules?**
  _Cohesion score 0.0601404741000878 - nodes in this community are weakly interconnected._
- **Should `Element Diagnostics` be split into smaller, more focused modules?**
  _Cohesion score 0.08176100628930817 - nodes in this community are weakly interconnected._