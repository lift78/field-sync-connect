import { useEffect } from 'react';

export function useKeyboardHandler() {
  useEffect(() => {
    // Function to hide/show bottom navigation based on input focus
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if the focused element is an input, textarea, or contenteditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.getAttribute('role') === 'textbox'
      ) {
        // Hide bottom navigation
        const navbar = document.querySelector('.mobile-fixed-nav') as HTMLElement;
        if (navbar) {
          navbar.style.transform = 'translateY(100%)';
          navbar.style.transition = 'transform 0.3s ease-in-out';
        }
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if we're losing focus from an input element
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.getAttribute('role') === 'textbox'
      ) {
        // Show bottom navigation again after a short delay
        setTimeout(() => {
          const navbar = document.querySelector('.mobile-fixed-nav') as HTMLElement;
          if (navbar) {
            navbar.style.transform = 'translateY(0)';
          }
        }, 100);
      }
    };

    // Add event listeners
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Cleanup
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);
}