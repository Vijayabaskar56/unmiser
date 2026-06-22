export const meta = {
  name: 'extension-parity',
  description: 'Compare each unmiser extension vs Cashiro parser+test; close parser & test (fixture) gaps',
  phases: [
    { title: 'Analyze', detail: 'per-bank: Cashiro parser+test vs our manifest+fixtures' },
    { title: 'Apply', detail: 'add missing fixtures + improve manifest, validate' },
  ],
}

const BANKS = [{"bank":"Abu Dhabi Commercial Bank","pluginId":"ae.adcb.bank","manifest":"manifests/adcb.json","parser":"ADCBParser.kt","test":"ADCBParserTest.kt"},{"bank":"Emirates NBD","pluginId":"ae.emiratesnbd.bank","manifest":"manifests/emirates-nbd.json","parser":"EmiratesNBDParser.kt","test":"EmiratesNBDParserTest.kt"},{"bank":"First Abu Dhabi Bank","pluginId":"ae.fab.bank","manifest":"manifests/fab.json","parser":"FABParser.kt","test":"FABParserTest.kt"},{"bank":"Liv Bank","pluginId":"ae.liv.bank","manifest":"manifests/liv-bank.json","parser":"LivBankParser.kt","test":null},{"bank":"Mashreq Bank","pluginId":"ae.mashreq.bank","manifest":"manifests/mashreq-bank.json","parser":"MashreqBankParser.kt","test":"MashreqBankParserTest.kt"},{"bank":"UAE Bank","pluginId":"ae.uae.bank","manifest":"manifests/uae-bank.json","parser":"UAEBankParser.kt","test":null},{"bank":"Priorbank","pluginId":"by.priorbank.bank","manifest":"manifests/priorbank.json","parser":"PriorbankParser.kt","test":"PriorbankParserTest.kt"},{"bank":"Bancolombia","pluginId":"co.bancolombia.bank","manifest":"manifests/bancolombia.json","parser":"BancolombiaParser.kt","test":"BancolombiaParserTest.kt"},{"bank":"mBank CZ","pluginId":"cz.mbank.bank","manifest":"manifests/m-bank-cz.json","parser":"MBankCZParser.kt","test":"TestMBankCZParser.kt"},{"bank":"CIB Egypt","pluginId":"eg.cib.bank","manifest":"manifests/cib-egypt.json","parser":"CIBEgyptParser.kt","test":"CIBEgyptParserTest.kt"},{"bank":"Commercial Bank of Ethiopia","pluginId":"et.cbe.bank","manifest":"manifests/cbe-bank.json","parser":"CBEBankParser.kt","test":"TestCBEBankParser.kt"},{"bank":"Dashen Bank","pluginId":"et.dashen.bank","manifest":"manifests/dashen-bank.json","parser":"DashenBankParser.kt","test":null},{"bank":"Telebirr","pluginId":"et.telebirr.wallet","manifest":"manifests/telebirr.json","parser":"TelebirrParser.kt","test":"TestTelebirrParser.kt"},{"bank":"Zemen Bank","pluginId":"et.zemen.bank","manifest":"manifests/zemen-bank.json","parser":"ZemenBankParser.kt","test":null},{"bank":"BPCE","pluginId":"fr.bpce.bank","manifest":"manifests/bpce.json","parser":"BPCEParser.kt","test":"BPCEParserTest.kt"},{"bank":"Airtel Payments Bank","pluginId":"in.airtel.bank","manifest":"manifests/airtel-payments-bank.json","parser":"AirtelPaymentsBankParser.kt","test":null},{"bank":"Amazon Pay","pluginId":"in.amazonpay.wallet","manifest":"manifests/juspay.json","parser":"JuspayParser.kt","test":"JuspayParserTest.kt"},{"bank":"American Express","pluginId":"in.amex.card","manifest":"manifests/amex-bank.json","parser":"AMEXBankParser.kt","test":null},{"bank":"AU Small Finance Bank","pluginId":"in.au.bank","manifest":"manifests/au-bank.json","parser":"AUBankParser.kt","test":"TestAUBankParser.kt"},{"bank":"Axis Bank","pluginId":"in.axis.bank","manifest":"manifests/axis-bank.json","parser":"AxisBankParser.kt","test":"AxisBankParserTest.kt"},{"bank":"Bandhan Bank","pluginId":"in.bandhan.bank","manifest":"manifests/bandhan-bank.json","parser":"BandhanBankParser.kt","test":"BandhanBankParserTest.kt"},{"bank":"Bank of Baroda","pluginId":"in.bob.bank","manifest":"manifests/bank-of-baroda.json","parser":"BankOfBarodaParser.kt","test":"BankOfBarodaParserTest.kt"},{"bank":"Bank of India","pluginId":"in.boi.bank","manifest":"manifests/bank-of-india.json","parser":"BankOfIndiaParser.kt","test":"BankOfIndiaParserTest.kt"},{"bank":"Canara Bank","pluginId":"in.canara.bank","manifest":"manifests/canara-bank.json","parser":"CanaraBankParser.kt","test":null},{"bank":"Central Bank of India","pluginId":"in.cboi.bank","manifest":"manifests/central-bank-of-india.json","parser":"CentralBankOfIndiaParser.kt","test":null},{"bank":"City Union Bank","pluginId":"in.cityunion.bank","manifest":"manifests/city-union-bank.json","parser":"CityUnionBankParser.kt","test":null},{"bank":"CRED","pluginId":"in.cred.wallet","manifest":"manifests/cred.json","parser":"CredParser.kt","test":"CredParserTest.kt"},{"bank":"DBS Bank","pluginId":"in.dbs.bank","manifest":"manifests/dbs-bank.json","parser":"DBSBankParser.kt","test":null},{"bank":"Dhanlaxmi Bank","pluginId":"in.dhanlaxmi.bank","manifest":"manifests/dhanlaxmi-bank.json","parser":"DhanlaxmiBankParser.kt","test":"DhanlaxmiBankParserTest.kt"},{"bank":"Department of Post","pluginId":"in.dop.bank","manifest":"manifests/dop-bank.json","parser":"DOPBankParser.kt","test":"DOPBankParserTest.kt"},{"bank":"Equitas Small Finance Bank","pluginId":"in.equitas.bank","manifest":"manifests/equitas-bank.json","parser":"EquitasBankParser.kt","test":null},{"bank":"Federal Bank","pluginId":"in.federal.bank","manifest":"manifests/federal-bank.json","parser":"FederalBankParser.kt","test":"FederalBankParserTest.kt"},{"bank":"HDFC Bank","pluginId":"in.hdfc.bank","manifest":"manifests/hdfc-bank.json","parser":"HDFCBankParser.kt","test":"HDFCBankParserTest.kt"},{"bank":"HDFC Mutual Fund","pluginId":"in.hdfcmf.bank","manifest":"manifests/hdfc-mutual-fund.json","parser":"HDFCMutualFundParser.kt","test":null},{"bank":"HSBC Bank","pluginId":"in.hsbc.bank","manifest":"manifests/hsbc-bank.json","parser":"HSBCBankParser.kt","test":"HSBCBankParserTest.kt"},{"bank":"ICICI Bank","pluginId":"in.icici.bank","manifest":"manifests/icici-bank.json","parser":"ICICIBankParser.kt","test":"ICICIBankParserTest.kt"},{"bank":"IDBI Bank","pluginId":"in.idbi.bank","manifest":"manifests/idbi-bank.json","parser":"IDBIBankParser.kt","test":null},{"bank":"IDFC First Bank","pluginId":"in.idfcfirst.bank","manifest":"manifests/idfc-first-bank.json","parser":"IDFCFirstBankParser.kt","test":"IDFCFirstBankParserTest.kt"},{"bank":"Indian Bank","pluginId":"in.indianbank.bank","manifest":"manifests/indian-bank.json","parser":"IndianBankParser.kt","test":"IndianBankParserTest.kt"},{"bank":"IndusInd Bank","pluginId":"in.indusind.bank","manifest":"manifests/indus-ind-bank.json","parser":"IndusIndBankParser.kt","test":"IndusIndBankParserTest.kt"},{"bank":"Indian Overseas Bank","pluginId":"in.iob.bank","manifest":"manifests/iob-bank.json","parser":"IndianOverseasBankParser.kt","test":"IndianOverseasBankParserTest.kt"},{"bank":"India Post Payments Bank","pluginId":"in.ippb.bank","manifest":"manifests/ippb.json","parser":"IPPBParser.kt","test":null},{"bank":"JioPay","pluginId":"in.jio.jiopay","manifest":"manifests/jiopay.json","parser":"JioPayParser.kt","test":null},{"bank":"Jio Payments Bank","pluginId":"in.jiopayments.bank","manifest":"manifests/jio-payments-bank.json","parser":"JioPaymentsBankParser.kt","test":null},{"bank":"JK Bank","pluginId":"in.jkbank.bank","manifest":"manifests/jk-bank.json","parser":"JKBankParser.kt","test":null},{"bank":"Jupiter","pluginId":"in.jupiter.bank","manifest":"manifests/jupiter-bank.json","parser":"JupiterBankParser.kt","test":null},{"bank":"Karnataka Bank","pluginId":"in.karnataka.bank","manifest":"manifests/karnataka-bank.json","parser":"KarnatakaBankParser.kt","test":null},{"bank":"Kerala Gramin Bank","pluginId":"in.keralagramin.bank","manifest":"manifests/kerala-gramin-bank.json","parser":"KeralaGraminBankParser.kt","test":"KeralaGraminBankParserTest.kt"},{"bank":"Kotak Bank","pluginId":"in.kotak.bank","manifest":"manifests/kotak-bank.json","parser":"KotakBankParser.kt","test":"KotakBankParserTest.kt"},{"bank":"LazyPay","pluginId":"in.lazypay.wallet","manifest":"manifests/lazy-pay.json","parser":"LazyPayParser.kt","test":null},{"bank":"OneCard","pluginId":"in.onecard.card","manifest":"manifests/one-card.json","parser":"OneCardParser.kt","test":null},{"bank":"Punjab National Bank","pluginId":"in.pnb.bank","manifest":"manifests/pnb-bank.json","parser":"PNBBankParser.kt","test":"PNBBankParserTest.kt"},{"bank":"Saraswat Co-operative Bank","pluginId":"in.saraswat.bank","manifest":"manifests/saraswat-bank.json","parser":"SaraswatBankParser.kt","test":"SaraswatBankParserTest.kt"},{"bank":"State Bank of India","pluginId":"in.sbi.bank","manifest":"manifests/sbi-bank.json","parser":"SBIBankParser.kt","test":"SBIBankParserTest.kt"},{"bank":"South Indian Bank","pluginId":"in.sib.bank","manifest":"manifests/south-indian-bank.json","parser":"SouthIndianBankParser.kt","test":"SouthIndianBankParserTest.kt"},{"bank":"Slice","pluginId":"in.slice","manifest":"manifests/slice.json","parser":"SliceParser.kt","test":null},{"bank":"Standard Chartered Bank","pluginId":"in.standardchartered.bank","manifest":"manifests/standard-chartered-bank.json","parser":"StandardCharteredBankParser.kt","test":"StandardCharteredBankParserTest.kt"},{"bank":"UCO Bank","pluginId":"in.uco.bank","manifest":"manifests/uco-bank.json","parser":"UCOBankParser.kt","test":null},{"bank":"Union Bank of India","pluginId":"in.unionbank.bank","manifest":"manifests/union-bank.json","parser":"UnionBankParser.kt","test":null},{"bank":"Utkarsh Bank","pluginId":"in.utkarsh.card","manifest":"manifests/utkarsh-bank.json","parser":"UtkarshBankParser.kt","test":null},{"bank":"Yes Bank","pluginId":"in.yesbank.bank","manifest":"manifests/yes-bank.json","parser":"YesBankParser.kt","test":"YesBankParserTest.kt"},{"bank":"Melli Bank","pluginId":"ir.melli.bank","manifest":"manifests/melli-bank.json","parser":"MelliBankParser.kt","test":"MelliBankParserTest.kt"},{"bank":"Parsian Bank","pluginId":"ir.parsian.bank","manifest":"manifests/parsian-bank.json","parser":"ParsianBankParser.kt","test":"ParsianBankParserTest.kt"},{"bank":"M-PESA","pluginId":"ke.mpesa.wallet","manifest":"manifests/mpesa.json","parser":"MPESAParser.kt","test":"MPESAParserTest.kt"},{"bank":"Everest Bank","pluginId":"np.everest.bank","manifest":"manifests/everest-bank.json","parser":"EverestBankParser.kt","test":"TestEverestBankParser.kt"},{"bank":"Laxmi Sunrise Bank","pluginId":"np.laxmi.bank","manifest":"manifests/laxmi-bank.json","parser":"LaxmiBankParser.kt","test":"LaxmiBankParserTest.kt"},{"bank":"Manjushree Finance","pluginId":"np.manjushree.bank","manifest":"manifests/manjushree-finance.json","parser":"ManjushreeFinanceParser.kt","test":"ManjushreeFinanceParserTest.kt"},{"bank":"Nabil Bank","pluginId":"np.nabil.bank","manifest":"manifests/nabil-bank.json","parser":"NabilBankParser.kt","test":"NabilBankParserTest.kt"},{"bank":"NMB Bank","pluginId":"np.nmb.bank","manifest":"manifests/nmb-bank.json","parser":"NMBBankParser.kt","test":"NMBBankParserTest.kt"},{"bank":"Prime Commercial Bank","pluginId":"np.primecommercial.bank","manifest":"manifests/prime-commercial-bank.json","parser":"PrimeCommercialBankParser.kt","test":"PrimeCommercialBankParserTest.kt"},{"bank":"Siddhartha Bank","pluginId":"np.siddhartha.bank","manifest":"manifests/siddhartha-bank.json","parser":"SiddharthaBankParser.kt","test":"SiddharthaBankParserTest.kt"},{"bank":"Bank Muscat","pluginId":"om.bankmuscat.bank","manifest":"manifests/bank-muscat.json","parser":"BankMuscatParser.kt","test":"BankMuscatParserTest.kt"},{"bank":"Faysal Bank","pluginId":"pk.faysal.bank","manifest":"manifests/faysal-bank.json","parser":"FaysalBankParser.kt","test":"FaysalBankParserTest.kt"},{"bank":"T-Bank","pluginId":"ru.tbank.bank","manifest":"manifests/t-bank.json","parser":"TBankParser.kt","test":"TestTBankParser.kt"},{"bank":"Alinma Bank","pluginId":"sa.alinma.bank","manifest":"manifests/alinma-bank.json","parser":"AlinmaBankParser.kt","test":"AlinmaBankParserTest.kt"},{"bank":"Al Rajhi Bank","pluginId":"sa.alrajhi.bank","manifest":"manifests/al-rajhi-bank.json","parser":"AlRajhiBankParser.kt","test":"TestAlRajhiBankParser.kt"},{"bank":"BAAC","pluginId":"th.baac.bank","manifest":"manifests/baac-bank.json","parser":"BAACBankParser.kt","test":null},{"bank":"Bangkok Bank","pluginId":"th.bbl.bank","manifest":"manifests/bangkok-bank.json","parser":"BangkokBankParser.kt","test":null},{"bank":"CIMB Thai","pluginId":"th.cimb.bank","manifest":"manifests/cimb-thai.json","parser":"CIMBThaiParser.kt","test":null},{"bank":"Government Savings Bank","pluginId":"th.gsb.bank","manifest":"manifests/gsb-bank.json","parser":"GSBBankParser.kt","test":null},{"bank":"Kasikorn Bank","pluginId":"th.kasikorn.bank","manifest":"manifests/kasikorn-bank.json","parser":"KasikornBankParser.kt","test":null},{"bank":"Krungsri (Bank of Ayudhya)","pluginId":"th.krungsri.bank","manifest":"manifests/krungsri-bank.json","parser":"KrungsriBankParser.kt","test":null},{"bank":"Krungthai Bank","pluginId":"th.ktb.bank","manifest":"manifests/krung-thai-bank.json","parser":"KrungThaiBankParser.kt","test":null},{"bank":"KTC","pluginId":"th.ktc.card","manifest":"manifests/ktc-credit-card.json","parser":"KTCCreditCardParser.kt","test":null},{"bank":"Siam Commercial Bank","pluginId":"th.scb.bank","manifest":"manifests/siam-commercial-bank.json","parser":"SiamCommercialBankParser.kt","test":null},{"bank":"TMBThanachart Bank (TTB)","pluginId":"th.ttb.bank","manifest":"manifests/ttb-bank.json","parser":"TTBBankParser.kt","test":null},{"bank":"UOB Thailand","pluginId":"th.uob.bank","manifest":"manifests/uob-thailand.json","parser":"UOBThailandParser.kt","test":null},{"bank":"M-Pesa Tanzania","pluginId":"tz.mpesa.wallet","manifest":"manifests/m-pesa-tanzania.json","parser":"MPesaTanzaniaParser.kt","test":null},{"bank":"Selcom Pesa","pluginId":"tz.selcom.wallet","manifest":"manifests/selcom-pesa.json","parser":"SelcomPesaParser.kt","test":null},{"bank":"Tigo Pesa","pluginId":"tz.tigopesa.wallet","manifest":"manifests/tigo-pesa.json","parser":"TigoPesaParser.kt","test":null},{"bank":"AdelFi","pluginId":"us.adelfi.bank","manifest":"manifests/adel-fi.json","parser":"AdelFiParser.kt","test":"AdelFiParserTest.kt"},{"bank":"ALECU","pluginId":"us.alecu.bank","manifest":"manifests/alecu-bank.json","parser":"AlecuBankParser.kt","test":"TestAlecuBankParser.kt"},{"bank":"Chase","pluginId":"us.chase.bank","manifest":"manifests/chase-bank.json","parser":"ChaseBankParser.kt","test":"TestChaseBankParser.kt"},{"bank":"Citi Bank","pluginId":"us.citi.card","manifest":"manifests/citi-bank.json","parser":"CitiBankParser.kt","test":"CitiBankParserTest.kt"},{"bank":"Discover Card","pluginId":"us.discover.card","manifest":"manifests/discover-card.json","parser":"DiscoverCardParser.kt","test":"DiscoverCardParserTest.kt"},{"bank":"Huntington Bank","pluginId":"us.huntington.bank","manifest":"manifests/huntington-bank.json","parser":"HuntingtonBankParser.kt","test":"HuntingtonBankParserTest.kt"},{"bank":"Navy Federal Credit Union","pluginId":"us.navyfederal.bank","manifest":"manifests/navy-federal.json","parser":"NavyFederalParser.kt","test":"NavyFederalParserTest.kt"},{"bank":"Old Hickory Credit Union","pluginId":"us.oldhickory.bank","manifest":"manifests/old-hickory.json","parser":"OldHickoryParser.kt","test":"OldHickoryParserTest.kt"},{"bank":"Charles Schwab","pluginId":"us.schwab.bank","manifest":"manifests/charles-schwab.json","parser":"CharlesSchwabParser.kt","test":"CharlesSchwabParserTest.kt"}]

const CASHIRO = '/Users/vijayabaskar/work/references/Cashiro/parser-core/src'
const PDIR = CASHIRO + '/main/kotlin/com/ritesh/parser/core/bank'
const TDIR = CASHIRO + '/test/kotlin/com/ritesh/parser/core/bank'
const EXT = '/Users/vijayabaskar/work/unmiser-extensions'

const GAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bank: { type: 'string' },
    hasGaps: { type: 'boolean' },
    parserGaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          format: { type: 'string' },
          cashiroHandles: { type: 'string' },
          ourBehavior: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['format', 'cashiroHandles', 'ourBehavior', 'severity'],
      },
    },
    testGaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          caseName: { type: 'string' },
          sampleBody: { type: 'string' },
          sender: { type: 'string' },
          expectedFields: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['caseName', 'sampleBody', 'reason'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['bank', 'hasGaps', 'parserGaps', 'testGaps', 'summary'],
}

const APPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bank: { type: 'string' },
    fixturesAdded: { type: 'number' },
    manifestImproved: { type: 'boolean' },
    validation: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
    changeSummary: { type: 'string' },
  },
  required: ['bank', 'fixturesAdded', 'manifestImproved', 'validation', 'changeSummary'],
}

function analyzePrompt(b) {
  const testLine = b.test
    ? `- Cashiro TEST (assertion cases = the behavioral test spec): ${TDIR}/${b.test}`
    : '- Cashiro TEST: NONE exists for this bank (do test-gap analysis from the parser\'s supported formats instead).'
  return [
    `You are auditing the Unmiser SMS parser extension for "${b.bank}" (pluginId ${b.pluginId}) against the original Cashiro Kotlin parser. READ-ONLY: do not edit anything in this stage.`,
    '',
    'Read these files COMPLETELY:',
    `- Cashiro PARSER (behavioral spec): ${PDIR}/${b.parser}`,
    testLine,
    `- Our extension manifest + fixtures: ${EXT}/${b.manifest}`,
    `Also skim ${EXT}/src/engine.ts only if you need to know how a manifest field maps to behavior (extract/pipeline/filter/typeRules/mandate).`,
    '',
    'Find TWO kinds of gap:',
    '1. PARSER gaps: message FORMATS or fields (amount/account-last4/merchant/type/balance/mandate) that Cashiro\'s parser handles but our manifest CANNOT produce. Mentally run representative bodies (from the Cashiro parser regexes and its test) through our manifest regexes to decide.',
    '2. TEST (fixture) gaps: distinct cases the Cashiro test asserts (or distinct formats the parser clearly supports) that our manifest\'s fixtures[] do NOT cover. For each, give a concrete sampleBody, sender if known, and expectedFields as a compact JSON string (amount, merchant, accountLast4, transactionType, balance, reference where applicable) derived from Cashiro\'s asserted expectations.',
    '',
    'Only report REAL gaps grounded in the Cashiro source. If our manifest already covers everything, set hasGaps=false with empty arrays. Be precise; this drives an automated fix step.',
  ].join('\n')
}

function applyPrompt(b, gaps) {
  return [
    `You are improving the Unmiser SMS parser extension for "${b.bank}" (${b.pluginId}) to reach parity with Cashiro. Edit ONLY this one file: ${EXT}/${b.manifest}`,
    '',
    'Gap analysis to act on (from the analyze stage):',
    JSON.stringify(gaps, null, 2),
    '',
    'Reference (read as needed):',
    `- Cashiro parser spec: ${PDIR}/${b.parser}`,
    b.test ? `- Cashiro test: ${TDIR}/${b.test}` : '- (no Cashiro test)',
    `- Manifest schema (valid fields/shape): ${EXT}/manifest.schema.json and ${EXT}/src/manifest-schema.ts`,
    '',
    'Do BOTH where gaps exist:',
    'A. TEST gap -> add new entries to the manifest\'s fixtures[] array covering each missing case (name, sender, receivedAt ISO, body, expected:{confidence, fields:{...}}). NEVER remove or weaken existing fixtures.',
    'B. PARSER gap -> minimally improve manifest extract/pipeline/filter/typeRules/mandate so the new fixtures (and the Cashiro-supported formats) parse correctly. Keep changes conservative and consistent with the existing manifest style; do not break existing fixtures.',
    '',
    'Then VALIDATE (this is mandatory and must pass):',
    `  cd ${EXT} && bun scripts/validate-manifest.ts ${b.manifest}`,
    'Iterate until it prints "OK ...: N fixtures pass". If you cannot make a particular new fixture pass without risky changes, drop that fixture (note it) rather than leaving validation failing or weakening the manifest.',
    '',
    'Return what you changed and the final validation status.',
  ].join('\n')
}

phase('Analyze')
const results = await pipeline(
  BANKS,
  (b) => agent(analyzePrompt(b), { label: `analyze:${b.pluginId}`, phase: 'Analyze', schema: GAP_SCHEMA }),
  (gaps, b) => {
    if (!gaps || !gaps.hasGaps) {
      return { bank: b.bank, fixturesAdded: 0, manifestImproved: false, validation: 'skipped', changeSummary: 'no gaps' }
    }
    return agent(applyPrompt(b, gaps), { label: `apply:${b.pluginId}`, phase: 'Apply', schema: APPLY_SCHEMA })
  },
)

const done = results.filter(Boolean)
const improved = done.filter((r) => r.validation === 'pass')
const failed = done.filter((r) => r.validation === 'fail')
const skipped = done.filter((r) => r.validation === 'skipped')
log(`Parity sweep: ${improved.length} improved, ${skipped.length} already-good, ${failed.length} failed validation`)
return {
  totals: { banks: BANKS.length, improved: improved.length, skipped: skipped.length, failed: failed.length },
  improved: improved.map((r) => ({ bank: r.bank, fixturesAdded: r.fixturesAdded, change: r.changeSummary })),
  failed: failed.map((r) => ({ bank: r.bank, change: r.changeSummary })),
}
