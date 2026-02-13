/* Optional virtual tours per listing (admin-managed).
 * Format:
 * window.SCP_VIRTUAL_TOURS['SCP-XXXX'] = {
 *   title: 'Showroom walk-through',
 *   scenes: [
 *     {
 *       id: 'entrance',
 *       name: 'Entrance',
 *       pano: 'https://.../insta360-entrance.jpg',
 *       position: [0, 0, 0],
 *       yaw: 8,
 *       pitch: 0,
 *       links: [{ to: 'living', label: 'Living room', yaw: 28, pitch: -2 }]
 *     }
 *   ]
 * };
 */

window.SCP_VIRTUAL_TOURS = window.SCP_VIRTUAL_TOURS || {};
