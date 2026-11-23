import { lazy, Suspense, Component } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, ChefHat, Timer, BellRing, CreditCard, Users } from 'lucide-react';
import { Brand, ThemeToggle } from '../components/ui.jsx';
import { useAuth, homeFor } from '../auth.jsx';

const Hero3D = lazy(() => import('../components/Hero3D.jsx'));

// If a phone has no WebGL, the page still works without the 3D scene.
class Safe extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

const FEATURES = [
  { icon: QrCode, title: 'A QR code for every table', text: 'Set your table count and get a ready-to-print QR for each one, styled with your colours and your logo in the centre.' },
  { icon: Users, title: 'Menu on the customer\'s phone', text: 'Guests scan, browse, add to cart and order. No app to install, no waiting for a printed menu.' },
  { icon: Timer, title: 'Kitchen sets the time', text: 'Your chef picks the preparation time and the guest sees a live countdown that keeps running if the kitchen adds minutes.' },
  { icon: BellRing, title: 'Call the waiter', text: 'One tap on the table page puts a request on every waiter\'s screen with the table number.' },
  { icon: CreditCard, title: 'Bill and payment', text: 'The bill is generated with tax the moment the order is placed. Guests pay by UPI or card, or ask the waiter to collect cash.' },
  { icon: ChefHat, title: 'Wall QR for walk-ins', text: 'Put a menu-only QR on the wall. People can check dishes and what is sold out before they sit down.' },
];

const STEPS = [
  ['Register your restaurant', 'Add your name, how many tables you have and your logo.'],
  ['Build the menu', 'Add dishes with prices, veg or non-veg, and preparation time. Mark anything sold out in one tap.'],
  ['Print the QR codes', 'Download or print table QRs and a wall QR. Stick one on each table.'],
  ['Give your team a login', 'Create chef and waiter accounts. The chef sets timers, the waiter answers calls.'],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div>
      <header className="l-nav">
        <div className="inner">
          <Brand />
          <div className="row">
            <ThemeToggle />
            {user ? (
              <Link to={homeFor(user.role)} className="btn primary">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn ghost">Sign in</Link>
                <Link to="/register" className="btn primary">Register restaurant</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Every table is one scan from ordering.</h1>
            <p className="lead">
              DineFlow gives your restaurant QR menus, live orders, kitchen timers, a waiter call button and billing, from a single dashboard.
            </p>
            <div className="actions">
              <Link to="/register" className="btn primary lg">Register your restaurant</Link>
              <Link to="/r/spice-route-kitchen?table=3" className="btn lg">Try the demo table</Link>
            </div>
          </div>
          <div className="hero-3d" aria-hidden="true">
            <Safe>
              <Suspense fallback={null}>
                <Hero3D />
              </Suspense>
            </Safe>
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="wrap">
          <h2>Everything the floor needs, nothing it doesn't.</h2>
          <p className="sub">Built for owners, chefs and waiters who are already busy. Each role sees only what they use.</p>
          <div className="feat-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="feat" key={title}>
                <Icon size={26} />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>Live in an afternoon.</h2>
          <div className="steps">
            {STEPS.map(([title, text], i) => (
              <div className="step" key={title}>
                <b>{i + 1}</b>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2>One account for owners, separate logins for staff.</h2>
          <div className="roles">
            <div className="card"><h3>Owner</h3><p className="muted" style={{ marginTop: 8 }}>Menu, tables, QR codes, staff accounts, settings and sales.</p></div>
            <div className="card"><h3>Chef</h3><p className="muted" style={{ marginTop: 8 }}>Sees new orders, sets the preparation time, marks dishes ready or sold out.</p></div>
            <div className="card"><h3>Waiter</h3><p className="muted" style={{ marginTop: 8 }}>Gets help and bill requests, serves ready orders and collects cash.</p></div>
          </div>
        </div>
      </section>

      <section className="l-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <h2>Ready to retire the paper menu?</h2>
            <Link to="/register" className="btn lg">Register your restaurant</Link>
          </div>
        </div>
      </section>

      <footer className="l-foot">
        <div className="wrap row between wrap"><Brand /><span>Restaurant automation for owners, chefs and waiters.</span></div>
      </footer>
    </div>
  );
}
