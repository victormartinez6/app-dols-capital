import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyData from './CompanyData';
import RepresentativeData from './RepresentativeData';
import AddressData from './AddressData';
import CreditData from './CreditData';

export default function CompanyForm() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('company');

  const renderStep = () => {
    switch (currentStep) {
      case 'company':
        return <CompanyData onNext={() => setCurrentStep('representative')} />;
      case 'representative':
        return <RepresentativeData onNext={() => setCurrentStep('address')} onBack={() => setCurrentStep('company')} />;
      case 'address':
        return <AddressData onNext={() => setCurrentStep('credit')} onBack={() => setCurrentStep('representative')} />;
      case 'credit':
        return <CreditData onBack={() => setCurrentStep('address')} onNext={() => navigate('/', { replace: true })} />;
      default:
        return <CompanyData onNext={() => setCurrentStep('representative')} />;
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col justify-center">
      {renderStep()}
    </div>
  );
}