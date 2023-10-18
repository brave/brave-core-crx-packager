let Sentry = null

if (process.env.sentry) {
  Sentry = await import('@sentry/node')
  Sentry.init({ dsn: process.env.sentry })
}

export default Sentry
