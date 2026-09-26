// Dev-only gallery of the components/ui primitives, served at /dev/ui by main.jsx while
// import.meta.env.DEV is true; the production build never includes it. main.jsx checks the path
// before it renders the app, so the gallery needs no route (in a build, /dev/ui is the 404 page).
import { useEffect, useRef, useState } from 'react'
import { MemoryRouter } from 'react-router'
import {
  Badge,
  Button,
  Card,
  CardLink,
  Chip,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  NumberInput,
  PageHeader,
  Segmented,
  Select,
  StatTile,
  StatusChip,
  Switch,
  Textarea,
} from '../components/ui'
import { BrakesIcon, CalendarIcon, CarIcon, ExportIcon, FuelIcon, OilDropIcon, PencilIcon, TrashIcon, WrenchIcon } from '../components/icons'
import ChartGallery from './ChartGallery'

const TOKENS = [
  { name: 'page', swatch: 'bg-page' },
  { name: 'surface', swatch: 'bg-surface' },
  { name: 'ink', swatch: 'bg-ink' },
  { name: 'slate', swatch: 'bg-slate' },
  { name: 'accent', swatch: 'bg-accent' },
  { name: 'accent-hover', swatch: 'bg-accent-hover' },
  { name: 'accent-on-dark', swatch: 'bg-accent-on-dark' },
  { name: 'teal', swatch: 'bg-teal' },
  { name: 'amber', swatch: 'bg-amber' },
  { name: 'green', swatch: 'bg-green' },
  { name: 'green-on-dark', swatch: 'bg-green-on-dark' },
  { name: 'red', swatch: 'bg-red' },
  { name: 'white', swatch: 'bg-white' },
]

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger', 'dashed']
const ICON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger']
const TEXT_VARIANTS = ['link', 'link-danger', 'link-muted']
const SERVICES = ['Brake pads', 'Brake fluid', 'Brake rotors', 'Brake lines']
const PRICE_MODES = [{ value: 'perGallon', label: '$/gal' }, { value: 'total', label: 'total' }]
const TANK = [{ value: 'full', label: 'full' }, { value: 'partial', label: 'partial' }]
const ACTIVITY = ['All', 'Fuel', 'Service'].map((value) => ({ value, label: value }))
const RANGES = ['12 fills', '6 mo', '1 yr'].map((value) => ({ value, label: value }))
const PERFORMED_BY = [{ value: 'shop', label: 'Shop' }, { value: 'diy', label: 'DIY' }]
const DOCUMENTS = [
  { value: 'all', label: 'All' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'registration', label: 'Registration', disabled: true },
]

const HISTORY = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-${String(9 - Math.floor(i / 2)).padStart(2, '0')}-${i % 2 ? '03' : '19'}`,
  odometer: 84210 - i * 480,
  gallons: (15.9 - (i % 3) * 0.4).toFixed(1),
}))

function Section({ title, note, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        {note && <p className="text-xs font-mono text-ink/50 mt-1.5">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Caption({ children }) {
  return <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45">{children}</p>
}

function TokenSwatches() {
  const [channels] = useState(() => {
    const styles = getComputedStyle(document.documentElement)
    return Object.fromEntries(TOKENS.map(({ name }) => [name, styles.getPropertyValue(`--${name}`).trim()]))
  })
  return (
    <div className="grid grid-cols-4 gap-3.5">
      {TOKENS.map(({ name, swatch }) => (
        <div key={name} className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-control border border-ink/10 flex-none ${swatch}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-xs font-mono text-ink/50">{channels[name]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FillUpFields({ odometerRef }) {
  const [priceMode, setPriceMode] = useState('perGallon')
  const [tank, setTank] = useState('full')
  const [values, setValues] = useState({ odometer: '', gallons: '', price: '' })
  const update = (name) => (event) => setValues({ ...values, [name]: event.target.value })
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label={<><CalendarIcon size={14} className="flex-none" />Date</>}>
          <Input type="date" defaultValue="2026-09-25" />
        </Field>
        <Field label="Odometer" hint="Last: 84,210 on Aug 28">
          <NumberInput ref={odometerRef} inputMode="numeric" unit="mi" value={values.odometer} onChange={update('odometer')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gallons">
          <NumberInput unit="gal" placeholder="13.2" value={values.gallons} onChange={update('gallons')} />
        </Field>
        <Field
          label={priceMode === 'total' ? 'Total paid' : '$/Gal'}
          aside={<Segmented size="sm" aria-label="Price mode" options={PRICE_MODES} value={priceMode} onChange={setPriceMode} />}
        >
          <NumberInput unit={priceMode === 'total' ? '$' : '$/gal'} placeholder={priceMode === 'total' ? '45.67' : '3.46'} value={values.price} onChange={update('price')} />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        <Caption>Tank</Caption>
        <Segmented size="sm" aria-label="Tank" options={TANK} value={tank} onChange={setTank} />
      </div>
    </div>
  )
}

function LongHistory() {
  return (
    <div className="flex flex-col gap-2">
      <Caption>Recent fill-ups (scroll)</Caption>
      <Card padding="none">
        {HISTORY.map((row) => (
          <div key={row.date} className="flex items-center justify-between px-4 py-3 border-b border-ink/8 last:border-b-0 text-sm">
            <span>{row.date}</span>
            <span className="font-mono tabular-nums">{row.odometer.toLocaleString()} mi</span>
            <span className="font-mono tabular-nums">{row.gallons} gal</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

function DialogDemos() {
  const [open, setOpen] = useState(null)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [notify, setNotify] = useState(true)
  const [performedBy, setPerformedBy] = useState('shop')
  const odometerRef = useRef(null)
  const close = () => setOpen(null)
  const footer = (primary, variant = 'primary') => (
    <div className="flex gap-3">
      <Button variant={variant} className="flex-1" onClick={close}>{primary}</Button>
      <Button variant="ghost" className="flex-1" onClick={close}>Cancel</Button>
    </div>
  )

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => setOpen('sm')}>Open modal sm</Button>
        <Button variant="ghost" onClick={() => setOpen('md')}>Open modal md</Button>
        <Button variant="ghost" onClick={() => setOpen('lg')}>Open modal lg</Button>
        <Button variant="ghost" onClick={() => setOpen('drawer')}>Open drawer</Button>
      </div>

      <Modal open={open === 'sm'} onClose={close} size="sm" title="Delete The Wagon?" footer={footer('Delete vehicle', 'danger')}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-ink/60">
            This removes the vehicle with its 11 fill-ups, 4 service records and 2 payments. It can't be undone.
          </p>
          <Field label="Type the nickname to confirm" hint="The Wagon">
            <Input placeholder="The Wagon" />
          </Field>
          <Switch label="Export a CSV first" description="Saves everything to your downloads" checked={notify} onChange={setNotify} />
          <LongHistory />
        </div>
      </Modal>

      <Modal
        open={open === 'md'}
        onClose={close}
        size="md"
        initialFocus={odometerRef}
        title={<><FuelIcon size={20} className="text-accent" />Log fill-up</>}
        subtitle="The Wagon · 84,210 mi"
        footer={footer('Save fill-up')}
      >
        <div className="flex flex-col gap-6">
          <FillUpFields odometerRef={odometerRef} />
          <Field label="Notes">
            <Textarea placeholder="Station, receipt number…" />
          </Field>
          <LongHistory />
        </div>
      </Modal>

      <Modal open={open === 'lg'} onClose={close} size="lg" title="Edit vehicle" footer={footer('Save vehicle')}>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nickname"><Input defaultValue="The Wagon" /></Field>
            <Field label="Year"><NumberInput inputMode="numeric" defaultValue="2019" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Make"><Input defaultValue="Volvo" /></Field>
            <Field label="Model"><Input defaultValue="V60" /></Field>
            <Field label="Trim"><Input defaultValue="T5 Momentum" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Track by">
              <Select defaultValue="both">
                <option value="miles">Miles</option>
                <option value="months">Months</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <Field label="Performed by">
              <Segmented fullWidth options={PERFORMED_BY} value={performedBy} onChange={setPerformedBy} />
            </Field>
          </div>
          <Card padding="sm">
            <Switch label="Fuel & mileage" description="Fill-ups, MPG, cost per mile" checked={notify} onChange={setNotify} />
          </Card>
          <LongHistory />
        </div>
      </Modal>

      <Drawer
        open={open === 'drawer'}
        onClose={close}
        title="Log fill-up"
        subtitle="The Wagon · 84,210 mi"
        footer={footer('Save fill-up')}
      >
        <div className="flex flex-col gap-6">
          <FillUpFields />
          <Button variant="secondary" onClick={() => setNestedOpen(true)}>Open a nested modal</Button>
          <LongHistory />
        </div>
        <Modal
          open={nestedOpen}
          onClose={() => setNestedOpen(false)}
          size="sm"
          title="Add missed fill-up?"
          footer={<Button className="w-full" onClick={() => setNestedOpen(false)}>Got it</Button>}
        >
          <p className="text-sm text-ink/60">
            A nested dialog: Esc and Tab act on this one only, and closing it returns focus to the drawer.
          </p>
        </Modal>
      </Drawer>
    </>
  )
}

function ChipDemos() {
  const [category, setCategory] = useState('brakes')
  const [picked, setPicked] = useState(['Brake pads'])
  const toggle = (service) =>
    setPicked(picked.includes(service) ? picked.filter((s) => s !== service) : [...picked, service])
  const tile = (Icon, tint) => (
    <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-none ${tint}`}>
      <Icon size={16} className="flex-none" />
    </span>
  )
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2.5">
          <Chip icon={tile(OilDropIcon, 'bg-amber/12 text-amber')} selected={category === 'oil'} onClick={() => setCategory('oil')}>
            Oil
          </Chip>
          <Chip icon={tile(BrakesIcon, 'bg-red/12 text-red')} selected={category === 'brakes'} onClick={() => setCategory('brakes')}>
            Brakes
            {picked.length > 0 && <Badge variant="solid" tone="accent" className="ml-1">{picked.length}</Badge>}
          </Chip>
          <Chip icon={tile(WrenchIcon, 'bg-slate/10 text-slate')} disabled>
            Disabled
          </Chip>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {SERVICES.map((service) => (
            <Chip key={service} selected={picked.includes(service)} onClick={() => toggle(service)}>
              {service}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SERVICES.map((service) => (
            <Chip key={service} size="sm" selected={picked.includes(service)} onClick={() => toggle(service)}>
              {service}
            </Chip>
          ))}
          <span className="text-xs font-mono text-ink/50 self-center ml-2">size=&quot;sm&quot;</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {picked.map((service) => (
            <Chip key={service} removable aria-label={`Remove ${service}`} onClick={() => toggle(service)}>
              {service}
            </Chip>
          ))}
          {picked.length === 0 && <span className="text-xs font-mono text-ink/50">removable: pick a service above</span>}
        </div>
      </div>
    </Card>
  )
}

/** Every components/ui primitive in every state. Dev only, at /dev/ui. */
export default function UiGallery() {
  const [activity, setActivity] = useState('All')
  const [range, setRange] = useState('12 fills')
  const [priceMode, setPriceMode] = useState('perGallon')
  const [performedBy, setPerformedBy] = useState('shop')
  const [documents, setDocuments] = useState('all')
  const [darkRange, setDarkRange] = useState('6 mo')
  const [darkMode, setDarkMode] = useState('total')
  const [fuel, setFuel] = useState(true)
  const [service, setService] = useState(false)
  const [showError, setShowError] = useState(false)
  const [odometer, setOdometer] = useState('84210')

  useEffect(() => {
    document.title = 'UI gallery · Odometer'
  }, [])

  return (
    <main className="max-w-[1180px] mx-auto px-10 py-12 flex flex-col gap-14">
      <header>
        <p className="text-xs font-mono font-semibold tracking-widest uppercase text-ink/45 mb-2">Dev · /dev/ui</p>
        <h1 className="text-6xl font-bold tracking-tight">UI primitives</h1>
        <p className="text-sm text-ink/60 mt-2">
          Everything in <code className="font-mono">components/ui</code>. Build screens from these; extend a primitive instead of restyling one.
        </p>
      </header>

      <Section title="Color tokens" note="CSS variables on :root (index.css), used as rgb(var(--token) / alpha)">
        <TokenSwatches />
      </Section>

      <Section title="Button" note="variant × size, disabled, loading">
        <Card>
          <div className="grid grid-cols-[120px_repeat(4,max-content)] items-center gap-x-6 gap-y-4">
            <span />
            <Caption>sm</Caption>
            <Caption>md</Caption>
            <Caption>disabled</Caption>
            <Caption>loading</Caption>
            {VARIANTS.map((variant) => (
              <div key={variant} className="contents">
                <span className="text-sm font-mono">{variant}</span>
                <div><Button variant={variant} size="sm">Log now</Button></div>
                <div><Button variant={variant}>Save fill-up</Button></div>
                <div><Button variant={variant} disabled>Save fill-up</Button></div>
                <div><Button variant={variant} loading>Saving</Button></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="grid grid-cols-[120px_repeat(3,max-content)] items-center gap-x-8 gap-y-4">
            <span />
            <Caption>sm</Caption>
            <Caption>md</Caption>
            <Caption>disabled</Caption>
            {TEXT_VARIANTS.map((variant) => (
              <div key={variant} className="contents">
                <span className="text-sm font-mono">{variant}</span>
                <div><Button variant={variant} size="sm">EDIT</Button></div>
                <div><Button variant={variant}>Add the default intervals</Button></div>
                <div><Button variant={variant} size="sm" disabled>DEL</Button></div>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink/45 mt-4">
            Inside a sentence: No service intervals for The Wagon. <Button variant="link">Add the default intervals</Button>
          </p>
        </Card>
        <div className="grid grid-cols-2 gap-3.5">
          <Card>
            <Caption>With icons</Caption>
            <div className="flex flex-wrap gap-3 mt-3">
              <Button><FuelIcon size={18} className="flex-none" />Log fill-up</Button>
              <Button variant="ghost"><WrenchIcon size={18} className="flex-none" />Log service</Button>
              <Button variant="ghost" size="sm"><ExportIcon size={14} className="flex-none" />Export CSV</Button>
            </div>
          </Card>
          <Card tone="dark">
            <p className="text-xs font-mono font-semibold tracking-widest uppercase text-page/45">tone=&quot;dark&quot; (ghost only)</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <Button tone="dark" variant="ghost">Log service</Button>
              <Button tone="dark" variant="ghost" size="sm">All trends</Button>
              <Button tone="dark" variant="ghost" disabled>Disabled</Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="IconButton" note="aria-label required; danger stays neutral until hover">
        <Card>
          <div className="flex flex-wrap items-center gap-6">
            {ICON_VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <IconButton variant={variant} size="sm" aria-label={`${variant} small`}><PencilIcon size={16} /></IconButton>
                  <IconButton variant={variant} aria-label={`${variant} medium`}>
                    {variant === 'danger' ? <TrashIcon size={16} /> : <PencilIcon size={16} />}
                  </IconButton>
                  <IconButton variant={variant} disabled aria-label={`${variant} disabled`}><PencilIcon size={16} /></IconButton>
                </div>
                <span className="text-xs font-mono text-ink/50">{variant}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-2 bg-slate rounded-control p-2">
              <div className="flex items-center gap-2">
                <IconButton tone="dark" size="sm" aria-label="Dark small"><PencilIcon size={16} /></IconButton>
                <IconButton tone="dark" aria-label="Dark medium"><PencilIcon size={16} /></IconButton>
              </div>
              <span className="text-xs font-mono text-page/60">ghost, dark</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Field, Input, NumberInput, Select, Textarea" note="The error replaces the hint and sets aria-invalid">
        <Card>
          <div className="grid grid-cols-3 gap-x-6 gap-y-5">
            <Field label="Odometer" hint="Last: 84,210 on Aug 28" error={showError && 'Must be above 84,210 (Aug 28).'}>
              <NumberInput inputMode="numeric" unit="mi" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
            </Field>
            <Field label="Shop" error="Enter the shop name.">
              <Input placeholder="Jiffy Lube" />
            </Field>
            <Field label="Nickname" hint="Disabled">
              <Input defaultValue="The Wagon" disabled />
            </Field>
            <Field label={<><CalendarIcon size={14} className="flex-none" />Date</>}>
              <Input type="date" defaultValue="2026-09-25" />
            </Field>
            <Field label="$/Gal" aside={<Segmented size="sm" aria-label="Price mode" options={PRICE_MODES} value={priceMode} onChange={setPriceMode} />}>
              <NumberInput unit={priceMode === 'total' ? '$' : '$/gal'} placeholder="3.46" />
            </Field>
            <Field label="Gallons" hint="Wide values don't clip">
              <NumberInput unit="gal" defaultValue="1000.25" />
            </Field>
            <Field label="Track by">
              <Select defaultValue="miles">
                <option value="miles">Miles</option>
                <option value="months">Months</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <Field label="Months" hint="Disabled select">
              <Select disabled defaultValue="12">
                <option value="12">12</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea rows={2} placeholder="Parts used, receipt number…" />
            </Field>
            <Field label="Miles" hint={'className="w-24" sets the width'}>
              <NumberInput inputMode="numeric" defaultValue="5000" className="w-24" />
            </Field>
            <div>
              <Caption>Select sm (title row)</Caption>
              <Select size="sm" defaultValue="90-days" aria-label="Window, light" className="mt-2">
                <option value="90-days">Rolling 90 days</option>
                <option value="all-time">All time</option>
              </Select>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-ink/8">
            <Switch label="Show the odometer error" checked={showError} onChange={setShowError} />
          </div>
        </Card>
      </Section>

      <Section title="Segmented" note="radiogroup; arrow keys, Home and End move the selection">
        <div className="grid grid-cols-2 items-start gap-3.5">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Caption>sm · fuel price mode</Caption>
                <Segmented size="sm" aria-label="Price mode" options={PRICE_MODES} value={priceMode} onChange={setPriceMode} />
              </div>
              <div className="flex items-center justify-between">
                <Caption>md · activity filter</Caption>
                <Segmented aria-label="Activity filter" options={ACTIVITY} value={activity} onChange={setActivity} />
              </div>
              <div className="flex items-center justify-between">
                <Caption>md · trends range</Caption>
                <Segmented aria-label="Range" options={RANGES} value={range} onChange={setRange} />
              </div>
              <div className="flex items-center justify-between">
                <Caption>disabled option</Caption>
                <Segmented aria-label="Documents filter" options={DOCUMENTS} value={documents} onChange={setDocuments} />
              </div>
              <div className="flex items-center justify-between">
                <Caption>disabled group</Caption>
                <Segmented aria-label="Disabled filter" disabled options={ACTIVITY} value="Fuel" onChange={() => {}} />
              </div>
              <Field label="md · fullWidth (Performed by)">
                <Segmented fullWidth options={PERFORMED_BY} value={performedBy} onChange={setPerformedBy} />
              </Field>
            </div>
          </Card>
          <Card tone="dark">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-semibold tracking-widest uppercase text-page/45">sm · dark</p>
                <Segmented size="sm" tone="dark" aria-label="Price mode, dark" options={PRICE_MODES} value={darkMode} onChange={setDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-semibold tracking-widest uppercase text-page/45">md · dark</p>
                <Segmented tone="dark" aria-label="Range, dark" options={RANGES} value={darkRange} onChange={setDarkRange} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-semibold tracking-widest uppercase text-page/45">Select sm · dark</p>
                <Select size="sm" tone="dark" defaultValue="90-days" aria-label="Window, dark">
                  <option value="90-days">Rolling 90 days</option>
                  <option value="6-months">6 months</option>
                  <option value="all-time">All time</option>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Switch">
        <Card>
          <div className="grid grid-cols-2 gap-x-10 gap-y-5">
            <Switch label="Fuel & mileage" description="Fill-ups, MPG, cost per mile" checked={fuel} onChange={setFuel} />
            <Switch label="Maintenance" description="Service history and due reminders" checked={service} onChange={setService} />
            <Switch label="Disabled, on" checked disabled onChange={() => {}} />
            <Switch label="Disabled, off" checked={false} disabled onChange={() => {}} />
            <div className="flex items-center gap-3">
              <Switch aria-label="Bare switch, on" checked onChange={() => {}} />
              <Switch aria-label="Bare switch, off" checked={false} onChange={() => {}} />
              <span className="text-xs font-mono text-ink/50">no label (aria-label)</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Badge and StatusChip">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Fuel</Badge>
              <Badge tone="teal">Tires</Badge>
              <Badge tone="amber">Partial</Badge>
              <Badge tone="green">+4%</Badge>
              <Badge tone="red">Declined</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="solid" tone="accent">3 due</Badge>
              <Badge variant="solid" tone="accent">2</Badge>
              <Badge variant="solid">Neutral</Badge>
              <Badge variant="pill" tone="green">+2.1% vs prior fills</Badge>
              <Badge variant="pill" tone="red">−0.3% vs prior fills</Badge>
            </div>
            <div className="bg-slate rounded-control p-3 flex items-center gap-2">
              <span className="text-xs font-mono text-page/60">on slate:</span>
              <Badge variant="solid" tone="accent">4 due</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status="ok" />
              <StatusChip status="coming-up" />
              <StatusChip status="overdue" />
              <StatusChip status="overdue">Overdue 2,410 mi</StatusChip>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Chip" note="Toggle chips for pickers too big for Segmented; removable for the picked summary">
        <ChipDemos />
      </Section>

      <Section title="Card" note="padding none / sm 16 / md 22 / lg 24; tone dark; CardLink makes the whole card a link">
        <div className="grid grid-cols-5 gap-3.5">
          {['none', 'sm', 'md', 'lg'].map((padding) => (
            <Card key={padding} padding={padding}>
              <div className="bg-accent/10 text-accent text-xs font-mono p-2">padding=&quot;{padding}&quot;</div>
            </Card>
          ))}
          <Card tone="dark">
            <p className="text-sm font-semibold">Coming up</p>
            <p className="text-xs font-mono text-page/60 mt-1">tone=&quot;dark&quot;</p>
          </Card>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          <Card tone="muted" padding="sm">
            <p className="text-sm font-semibold">Sunken panel</p>
            <p className="text-xs font-mono text-ink/50 mt-1">tone=&quot;muted&quot;: a picker in a modal, a history row</p>
          </Card>
          <Card tone="accent" padding="sm">
            <p className="font-bold text-sm text-accent mb-1">Next due in 420 mi</p>
            <p className="text-xs text-ink/60">tone=&quot;accent&quot;: an informational callout</p>
          </Card>
          <Card tone="red" padding="sm">
            <p className="font-semibold text-red text-sm mb-1">Gallons exceed tank size</p>
            <p className="text-xs text-ink/60">tone=&quot;red&quot;: a warning, an overdue renewal</p>
          </Card>
        </div>
        {/* The gallery has no router of its own; CardLink is a react-router Link. */}
        <MemoryRouter>
          <div className="grid grid-cols-3 gap-3.5">
            <Card padding="sm" className="relative">
              <h3 className="text-lg font-semibold">
                <CardLink to="/v/1/overview">The Wagon</CardLink>
              </h3>
              <p className="text-xs font-mono text-ink/50 mt-1 mb-3">
                CardLink: click anywhere on the card, or Tab to it for the focus ring
              </p>
              <div className="relative z-10">
                <Button variant="ghost" size="sm">Own button, relative z-10</Button>
              </div>
            </Card>
          </div>
        </MemoryRouter>
      </Section>

      <Section title="PageHeader" note="eyebrow, title, optional subtitle, primary action; on every page">
        <Card>
          <PageHeader
            eyebrow="Maintenance"
            title="The Wagon — service"
            subtitle="Optional subtitle: 84,210 mi · driving 1,038 mi / mo"
            action={<Button>Log service</Button>}
          />
          <PageHeader eyebrow="Trends" title="The Wagon — trends" />
          <p className="text-xs font-mono text-ink/50">Without an action. PageHeader brings its own 22px bottom margin.</p>
        </Card>
      </Section>

      <Section title="EmptyState">
        <div className="grid grid-cols-2 gap-3.5">
          <EmptyState
            icon={CarIcon}
            title="Add your first vehicle"
            body="Fill-ups, maintenance, insurance and registration are all tracked per vehicle."
            action={<Button size="sm">Add vehicle</Button>}
          />
          <EmptyState
            icon={FuelIcon}
            title="Fuel tracking is off for The Wagon"
            body="This vehicle logs maintenance only. Turn fuel on to record fill-ups, MPG, and cost per mile."
            action={<Button size="sm">Enable fuel tracking</Button>}
          />
        </div>
      </Section>

      <Section title="StatTile" note="deltaTone is good / bad / neutral news, not up / down">
        <div className="grid grid-cols-4 gap-3.5">
          <StatTile label="Avg MPG" value="31.3" unit="mpg" delta="+2.1%" deltaTone="good" />
          <StatTile label="Cost / mile" value="$0.12" unit="per mi" />
          <StatTile label="Fuel spend" value="$182" unit="this mo" delta="+12%" deltaTone="bad" />
          <StatTile label="Services" value="4" unit="due soon" delta="no change" deltaTone="neutral">
            <div className="h-8 rounded border border-dashed border-ink/20 flex items-center justify-center text-xs font-mono text-ink/40">
              children: sparkline slot
            </div>
          </StatTile>
        </div>
      </Section>

      <Section title="Modal and Drawer" note="Esc, backdrop and × close; Tab is trapped; focus returns to the trigger">
        <DialogDemos />
      </Section>

      <ChartGallery />
    </main>
  )
}
