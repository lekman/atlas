/**
 * The sidebar's faces, bundled rather than fetched from Google. A font
 * request to a third party would send every viewer's IP address there
 * before the sidebar renders. The build inlines them as data URIs, so the
 * single HTML file still needs nothing from the network. Latin only, and
 * only the weights the sidebar uses.
 */
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
