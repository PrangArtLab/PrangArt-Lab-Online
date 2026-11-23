import { useNavigate } from 'react-router-dom';
import { OrderWorkspace } from '../components/OrderWorkspace';

export function OrderPage() {
  const navigate = useNavigate();

  return (
    <OrderWorkspace
      onSubmitted={() => {
        try {
          localStorage.setItem('pal_client_tab', 'projects');
        } catch {
          // ignore
        }
        navigate('/klien');
      }}
    />
  );
}
