(ns hardmode-core.src.core
  (:require
    [redis]
    [mori
      :refer [list hash-map is-map conj each into]]))


(defn execute-body!
  [context-or-member & body]
  (let [default-context { :redis-data   (redis.createClient process.env.REDIS "127.0.0.1" {})
                          :redis-events (redis.createClient process.env.REDIS "127.0.0.1" {}) }
        member-list     (if (> body.length 0) (into (list) body) (list))
        has-context     (is-map context-or-member)
        context         (if has-context context-or-member default-context)
        members         (if has-context
                          member-list
                          (conj member-list context-or-member))]
    (each members (fn [member]
      (member context)))))


;(defn init-session! [options]
  ;(let [console globals.console
        ;require globals.require
        ;env     globals.process.env
        ;config  (set! globals.config  {})
        ;modules (set! globals.modules {})]

    ;(if options.info
      ;(set! (aget globals.config "info") options.info))

    ;(if options.use
      ;(let [path  (require "path")
            ;Redis (require "redis")
            ;redis (Redis.createClient env.REDIS "127.0.0.1" {})]
        ;(redis.publish "using"
          ;(options.use.map (fn [module-name]
            ;(let [module-path (path.join "../modules" module-name "server.js")
                  ;module      (require module-path)]
              ;(console.log (str "Using module '" module-name "' from:") module-path)
              ;(set! (aget modules module-name) module)
              ;module-name))))))))


;(defn execute-body! [& body]
  ;(body.map (fn [ud]
    ;(let [context {"config" globals.config
                   ;"data"   globals.data}]
      ;(ud context)))))
