(ns hardmode-core.src.core
  (:require
    [redis]
    [mori :refer [list hash-map is-map conj each into first rest]]))


(defn get-default-context []
  (hash-map :redis-data   (redis.createClient process.env.REDIS "127.0.0.1" {})
            :redis-events (redis.createClient process.env.REDIS "127.0.0.1" {}) ) )


(defn execute-body!
  [context-or-member & body]

  ; consistent format for arguments:
  ; if `context-or-member` is a map (TODO not a function) then
  ; use it as a context object; otherwise assume it's a member
  (let [member-list     (if (> body.length 0) (into (list) body) (list))
        has-context     (is-map context-or-member)
        context         (if has-context
                          context-or-member
                          (get-default-context))
        members         (if has-context
                          member-list
                          (conj member-list context-or-member))]

    ; thread context object through each function of the body
    ; members have the choice to either return an optionally
    ; modified context, or in turn call `execute-body!` themselves
    (loop [context context
           members members]
      (console.log "\n" context)
      (if (first members)
        (recur ((first members) context) (rest members))
        context))))


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
