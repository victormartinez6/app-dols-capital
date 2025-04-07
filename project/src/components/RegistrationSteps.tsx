import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface RegistrationStepsProps {
  steps: Step[];
}

export default function RegistrationSteps({ steps }: RegistrationStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center">
        {steps.map((step, index) => (
          <li key={step.id} className={`relative ${index !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} ${index !== 0 ? 'pl-8 sm:pl-20' : ''}`}>
            {index !== steps.length - 1 && (
              <div
                className={`absolute top-4 left-0 -ml-px mt-0.5 w-full h-0.5 ${
                  step.isCompleted ? 'bg-white' : 'bg-gray-800'
                }`}
                aria-hidden="true"
              />
            )}

            <div className="relative flex flex-col items-center group">
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  step.isCompleted
                    ? 'border-white bg-white'
                    : step.isCurrent
                    ? 'border-white bg-black'
                    : 'border-gray-800 bg-black'
                }`}
              >
                {step.isCompleted ? (
                  <Check className="h-5 w-5 text-black" />
                ) : (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      step.isCurrent ? 'bg-white' : 'bg-gray-800'
                    }`}
                  />
                )}
              </div>
              <div className="absolute -bottom-10 w-32 text-center">
                <p
                  className={`text-sm font-medium ${
                    step.isCompleted || step.isCurrent ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}