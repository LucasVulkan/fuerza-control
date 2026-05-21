import { useStore, selectToast } from '../../store/useStore';

export default function Toast() {
  const toast = useStore(selectToast);

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      left: '50%',
      transform: toast
        ? 'translateX(-50%) translateY(0)'
        : 'translateX(-50%) translateY(12px)',
      background: 'var(--green)',
      color: 'var(--on-green)',
      padding: '9px 18px',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 500,
      opacity: toast ? 1 : 0,
      transition: 'all 0.3s',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      zIndex: 50,
    }}>
      {toast?.msg ?? ''}
    </div>
  );
}
