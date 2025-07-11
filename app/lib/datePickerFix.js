/**
 * Makes date input fields open their calendar when clicking anywhere on the input
 * Must be called after the DOM is loaded
 */
export function initializeDateInputs() {
  function setupDateInputs() {
    // Find all date input fields
    const dateInputs = document.querySelectorAll('input[type="date"]');
    
    // Process each date input
    dateInputs.forEach(input => {
      // Skip if already processed
      if (input.parentElement && input.parentElement.classList.contains('date-input-wrapper')) {
        return;
      }
      
      // Create wrapper div
      const wrapper = document.createElement('div');
      wrapper.className = 'date-input-wrapper';
      
      // Insert the wrapper before the input
      input.parentNode.insertBefore(wrapper, input);
      
      // Move the input inside the wrapper
      wrapper.appendChild(input);
    });
  }

  // Initial setup
  setupDateInputs();

  // Setup a MutationObserver to watch for dynamically added date inputs
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasDateInput = addedNodes.some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check the node itself
            if (node.tagName === 'INPUT' && node.type === 'date') {
              return true;
            }
            // Check children of this node
            return node.querySelectorAll('input[type="date"]').length > 0;
          }
          return false;
        });
        
        if (hasDateInput) {
          setupDateInputs();
        }
      }
    });
  });

  // Start observing document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Function to handle click on date input field
  const handleDateInputClick = (e) => {
    // Only run if the target is an input of type date
    if (e.target.tagName === 'INPUT' && e.target.type === 'date') {
      // Create a new input event and dispatch it
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      // Get the calendar picker indicator
      const calendarIcon = e.target.querySelector('::-webkit-calendar-picker-indicator');
      
      // If couldn't get it directly, try to show calendar by
      // simulating a click on the input itself, which should focus it
      // and make it ready for a key press
      e.target.focus();
      
      // Simulate clicking the calendar icon
      setTimeout(() => {
        // Simulate pressing down arrow key to open calendar
        const keyEvent = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          keyCode: 40, // Down arrow key
          which: 40
        });
        e.target.dispatchEvent(keyEvent);
      }, 100);
    }
  };

  // Add global click event listener to handle all date inputs
  document.addEventListener('click', handleDateInputClick);
} 