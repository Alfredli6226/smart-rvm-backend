import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 1. Change to function syntax to access 'mode'
export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    
    server: {
      port: 5173,      
      strictPort: true, 
      
      proxy: {
        '/api': {
          // FIX: Point to backend port (3000), NOT frontend port (5173)
          target: 'http://localhost:3000', 
          changeOrigin: true,
          secure: false, 
        }
      }
    },

    build: {
      // 1. Increase the warning limit to silence the alarm (optional but helpful)
      chunkSizeWarningLimit: 1600, 

      // 2. Tell Vite to split the code into smaller files
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Check if the code comes from "node_modules" (libraries)
            if (id.includes('node_modules')) {
              // Put Firebase in its own file (it's huge)
              if (id.includes('firebase')) return 'firebase';
              
              // Put Vue-related stuff in its own file
              if (id.includes('vue')) return 'vue';
              
              // Put everything else in a "vendor" file
              return 'vendor';
            }
          }
        }
      }
    },

    // 2. Add esbuild to strip logs in production
    esbuild: {
      pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
      drop: mode === 'production' ? ['debugger'] : [],
    },
  };
});