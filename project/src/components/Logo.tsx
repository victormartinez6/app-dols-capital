import logoColor from '../assets/Logo_Dols_Capital.svg';
import logoBranco from '../assets/Logo_Dols_Capital_Branco.svg';

export const Logo = ({ className = "w-auto h-12", variant = "default" }: { className?: string, variant?: "default" | "white" }) => {
  const logoSrc = variant === "white" ? logoBranco : logoColor;
  
  return (
    <img 
      src={logoSrc} 
      alt="Dols Capital" 
      className={className}
    />
  );
};