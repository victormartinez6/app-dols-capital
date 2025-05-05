import logoColor from '../assets/Logo_Dols_Capital.svg';
import logoBranco from '../assets/Logo_Dols_Capital_Branco.svg';
import logoMobile from '../assets/logo_dols_mobile.svg';

export const Logo = ({ className = "w-auto h-12", variant = "default", isMobile = false }: { className?: string, variant?: "default" | "white", isMobile?: boolean }) => {
  let logoSrc;
  
  if (isMobile) {
    logoSrc = logoMobile;
  } else {
    logoSrc = variant === "white" ? logoBranco : logoColor;
  }
  
  return (
    <img 
      src={logoSrc} 
      alt="Dols Capital" 
      className={className}
    />
  );
};