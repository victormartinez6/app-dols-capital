import React from 'react';
import CompanyData from './CompanyData';
import RepresentativeData from './RepresentativeData';
import AddressData from './AddressData';
import CreditData from './CreditData';

export default function CompanyForm() {
  const currentStep = sessionStorage.getItem('currentStep') || 'company';

  const renderStep = () => {
    switch (currentStep) {
      case 'company':
        return <CompanyData />;
      case 'representative':
        return <RepresentativeData />;
      case 'address':
        return <AddressData />;
      case 'credit':
        return <CreditData />;
      default:
        return <CompanyData />;
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col justify-center">
      {renderStep()}
    </div>
  );
}