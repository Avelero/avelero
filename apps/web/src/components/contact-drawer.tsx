'use client';

import { useState, useRef, useEffect } from 'react';
import { Drawer } from 'vaul';
import validator from 'validator';
import * as CompanyEmailValidator from 'company-email-validator';
import { Button } from "./button";
import { Input } from './input';
import { Icons } from '@v1/ui/icons';
import { cn } from '@v1/ui/cn';
import { submitContactForm } from '../actions/contact';

type DrawerState = 'collapsed' | 'expanded' | 'submitting' | 'success' | 'error';

interface FormData {
    email: string;
    name: string;
    company: string;
}

// Helper: Extract company name from email domain
const extractCompanyName = (email: string): string => {
    const domain = email.split('@')[1]?.split('.')[0] || '';
    return domain.charAt(0).toUpperCase() + domain.slice(1);
};

export function ContactDrawer() {
    const [isOpen, setIsOpen] = useState(false);
    const [drawerState, setDrawerState] = useState<DrawerState>('collapsed');
    const [hasEverExpanded, setHasEverExpanded] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        email: '',
        name: '',
        company: ''
    });
    const [emailError, setEmailError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [companyError, setCompanyError] = useState<string | null>(null);
    
    const emailInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Reset state when drawer closes
    useEffect(() => {
        if (!isOpen) {
            // Wait for drawer close animation to complete before resetting
            setTimeout(() => {
                setDrawerState('collapsed');
                setHasEverExpanded(false);
                setFormData({ email: '', name: '', company: '' });
                setEmailError(null);
                setNameError(null);
                setCompanyError(null);
            }, 300); // Vaul's default animation duration
        }
    }, [isOpen]);

    // Handle expanding from collapsed to expanded state
    const handleExpand = () => {
        // Clear any previous errors
        setEmailError(null);

        // Validate email
        if (!formData.email.trim()) {
            setEmailError('Please enter your email');
            return;
        }

        // Check 1: Valid email format
        if (!validator.isEmail(formData.email)) {
            setEmailError('Please enter a valid email');
            return;
        }

        // Check 2: Work email
        if (!CompanyEmailValidator.isCompanyEmail(formData.email)) {
            setEmailError('Please enter a work email');
            return;
        }

        // Extract and pre-fill company name
        const company = extractCompanyName(formData.email);
        setFormData(prev => ({ ...prev, company }));

        // Expand drawer and mark as expanded
        setDrawerState('expanded');
        setHasEverExpanded(true);
    };

    // Handle form submission
    const handleSubmit = async () => {
        // Clear previous errors
        setEmailError(null);
        setNameError(null);
        setCompanyError(null);
        
        let hasError = false;
        
        // Check 1: Valid email format
        if (!validator.isEmail(formData.email)) {
            setEmailError('Please enter a valid email');
            hasError = true;
        }
        
        // Check 2: Work email
        if (!CompanyEmailValidator.isCompanyEmail(formData.email)) {
            setEmailError('Please enter a work email');
            hasError = true;
        }

        // Check 3: Name is required
        if (!formData.name.trim()) {
            setNameError('Please enter your name');
            hasError = true;
        }

        // Check 4: Company is required
        if (!formData.company.trim()) {
            setCompanyError('Please enter your company name');
            hasError = true;
        }

        // Stop if there are any errors
        if (hasError) {
            return;
        }

        setDrawerState('submitting');

        try {
            const result = await submitContactForm({
                email: formData.email,
                name: formData.name,
                company: formData.company,
            });
            
            if (result.success) {
                setDrawerState('success');
            } else {
                setDrawerState('error');
            }
        } catch (error) {
            setDrawerState('error');
        }
    };

    // Handle Enter key press
    const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter') {
            action();
        }
    };

    return (
        <Drawer.Root modal={false} open={isOpen} onOpenChange={setIsOpen}>
            <Drawer.Trigger asChild>
                <Button variant="brand" aria-label="Open talk to founders drawer">Talk to founders</Button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <div 
                    data-state={isOpen ? "open" : "closed"}
                    className="fixed inset-0 z-50 bg-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
                <Drawer.Content 
                    className="fixed inset-x-3 bottom-0 mx-auto max-w-[369px] outline-none md:mx-auto md:w-full z-50"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <div
                        className={cn(
                            "flex flex-col bg-background border border-border p-3 rounded-md overflow-hidden relative shadow-lg mb-6 transition-all duration-150 ease-in-out",
                            // Form states
                            drawerState === 'collapsed' && !emailError && 'h-[62px]',
                            drawerState === 'collapsed' && emailError && 'h-[84px]',
                            (drawerState === 'expanded' || drawerState === 'submitting') && !emailError && !nameError && !companyError && 'h-[254px]',
                            (drawerState === 'expanded' || drawerState === 'submitting') && (emailError || nameError || companyError) && 'h-auto',
                            // Success/Error states
                            (drawerState === 'success' || drawerState === 'error') && 'h-[140px]'
                        )}
                    >
                        <Drawer.Title className="sr-only">Talk to founders</Drawer.Title>
                        <Drawer.Description className="sr-only">
                            Contact form to connect with the founders
                        </Drawer.Description>
                        
                        {/* Success State */}
                        {drawerState === 'success' && (
                            <div className="flex flex-col items-center justify-center text-center h-full gap-2">
                                <Icons.Check size={24} className="text-primary" />
                                <div>
                                    <h3 className="text-[16px] leading-[24px] font-medium text-foreground">
                                        Check your inbox!
                                    </h3>
                                    <p className="text-[14px] leading-[20px] text-foreground/50 mt-1">
                                        One of the founders will reach out shortly
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {drawerState === 'error' && (
                            <div className="flex flex-col items-center justify-center text-center h-full gap-2">
                                <Icons.X size={24} className="text-destructive" />
                                <div>
                                    <h3 className="text-[16px] leading-[24px] font-medium text-foreground">
                                        Oops, something went wrong
                                    </h3>
                                    <p className="text-[14px] leading-[20px] text-foreground/50 mt-1">
                                        Please try again
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Form - only show when not in success/error state */}
                        {drawerState !== 'success' && drawerState !== 'error' && (
                            <>
                                {/* Email input row */}
                                <div className="flex flex-row">
                            <Input 
                                ref={emailInputRef}
                                type="email" 
                                id="email" 
                                placeholder="Work email" 
                                value={formData.email}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, email: e.target.value }));
                                    setEmailError(null);
                                }}
                                onKeyDown={(e) => handleKeyPress(e, handleExpand)}
                                autoFocus
                                disabled={drawerState === 'submitting'}
                                className={cn(
                                    "transition-transform duration-150",
                                    emailError && "focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none"
                                )}
                                aria-invalid={!!emailError}
                            />
                            
                            {/* Chevron button - only visible in collapsed state and never expanded */}
                            <button 
                                type="button" 
                                onClick={handleExpand}
                                className={cn(
                                    "flex items-center justify-center ml-2 w-9 h-9 flex-shrink-0 bg-primary text-primary-foreground hover:brightness-[0.9] transition-all duration-150 cursor-pointer",
                                    drawerState === 'collapsed' && !hasEverExpanded ? 'opacity-100' : 'hidden'
                                )}
                                aria-label="Continue"
                            >
                                <Icons.ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Email error message */}
                        {emailError && (
                            <p className="text-micro text-destructive mt-1 px-0.5">
                                {emailError}
                            </p>
                        )}

                        {/* Expanded form fields */}
                        <div 
                            className={cn(
                                "flex flex-col gap-2 mt-2 transition-opacity duration-150",
                                drawerState === 'collapsed' ? 'opacity-0 pointer-events-none' : 'opacity-100'
                            )}
                        >
                            <div className="space-y-1">
                                <label htmlFor="name" className="text-small text-foreground/50">Name</label>
                                <Input 
                                    ref={nameInputRef}
                                    type="text" 
                                    id="name" 
                                    placeholder="Name" 
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, name: e.target.value }));
                                        setNameError(null);
                                    }}
                                    onKeyDown={(e) => handleKeyPress(e, handleSubmit)}
                                    disabled={drawerState === 'submitting'}
                                    className={cn(
                                        nameError && "focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none"
                                    )}
                                    aria-invalid={!!nameError}
                                />
                                {nameError && (
                                    <p className="text-micro text-destructive px-0.5">
                                        {nameError}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="company" className="text-small text-foreground/50">Company</label>
                                <Input 
                                    type="text" 
                                    id="company" 
                                    placeholder="Company name" 
                                    value={formData.company}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, company: e.target.value }));
                                        setCompanyError(null);
                                    }}
                                    onKeyDown={(e) => handleKeyPress(e, handleSubmit)}
                                    disabled={drawerState === 'submitting'}
                                    className={cn(
                                        companyError && "focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none"
                                    )}
                                    aria-invalid={!!companyError}
                                />
                                {companyError && (
                                    <p className="text-micro text-destructive px-0.5">
                                        {companyError}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={drawerState === 'submitting'}
                                className={cn(
                                    "w-full h-9 !text-small mt-1 transition-all duration-150 bg-primary text-primary-foreground hover:brightness-[0.9]",
                                    drawerState === 'submitting' && "opacity-70 cursor-not-allowed"
                                )}
                            >
                                {drawerState === 'submitting' ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                            </>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}