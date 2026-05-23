import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

if (key) {
  posthog.init(key, { api_host: host, capture_pageview: false });
}

export { posthog };
