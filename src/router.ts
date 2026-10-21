import { createRouter, createWebHistory } from 'vue-router'
import { expireIfNeeded, session } from './session'
import LoginView from './views/LoginView.vue'
import RfqListView from './views/RfqListView.vue'
import RfqNewView from './views/RfqNewView.vue'
import RfqDetailView from './views/RfqDetailView.vue'
import TaskProgressView from './views/TaskProgressView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/rfqs' },
    { path: '/login', component: LoginView },
    { path: '/rfqs', component: RfqListView, meta: { auth: true } },
    { path: '/rfqs/new', component: RfqNewView, meta: { auth: true, customerOnly: true } },
    { path: '/rfqs/:rfqId', component: RfqDetailView, props: true, meta: { auth: true } },
    { path: '/tasks/:taskId', component: TaskProgressView, props: true, meta: { auth: true } },
  ],
})

router.beforeEach((to) => {
  expireIfNeeded()
  if (to.meta.auth && !session.token) return { path: '/login', query: { next: to.fullPath } }
  if (to.path === '/login' && session.token) return { path: '/rfqs' }
  if (to.meta.customerOnly && session.user?.user_type === 'MANAGER') return { path: '/rfqs' }
  return true
})

export default router
