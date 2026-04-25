import Header from './Header';
import Footer from './Footer';
import AiToast from '../components/AiToast/AiToast';
import './Layout.scss';

function Layout({ children }) {
  return (
    <div className="layout">
      <Header />
      <main className="layout__main">
        {children}
      </main>
      <Footer />
      <AiToast />
    </div>
  );
}

export default Layout;
