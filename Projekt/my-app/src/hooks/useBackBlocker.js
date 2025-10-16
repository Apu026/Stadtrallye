import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function useBackBlocker(
  message = 'Zurück ist hier nicht erlaubt.',
  redirectPath = null
) {
  const navigate = useNavigate();
  useEffect(() => {
    const trap = () => {
      try {
        // eslint-disable-next-line no-alert
        alert(message);
        if (redirectPath) {
          navigate(redirectPath, { replace: true });
        } else {
          window.history.pushState(null, '', window.location.href);
        }
      } catch {}
    };

    try {
      // Create a small barrier so popstate fires and we can intercept
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', trap);
    } catch {}

    return () => {
      try { window.removeEventListener('popstate', trap); } catch {}
    };
  }, [message, redirectPath, navigate]);
}
