var esprima   = require('esprima')   // transform jade
  , escodegen = require('escodegen') // jade transform
  , path      = require('path')      // path operation
  , through   = require('through')   // stream utility


var MODULE_EXPORTS         =
    { type:     "MemberExpression"
    , computed: false
    , object:   { type: "Identifier", name: "module"  }
    , property: { type: "Identifier", name: "exports" } }

  , MODULE_EXPORTS_STMT    =
    { type: "ExpressionStatement"
    , expression: MODULE_EXPORTS }

  , JADE_MIXINS_DECLARATOR =
    { type: "VariableDeclarator"
    , id:   { type: "Identifier", name: "jade_mixins" }
    , init: MODULE_EXPORTS_STMT }

  , BUF_PUSH = function(node){

      function bufPush (node) {
        if (node.type                          === 'ExpressionStatement' &&
            node.expression.type               === 'CallExpression'      &&
            node.expression.callee.type        === 'MemberExpression'    &&
            node.expression.callee.object.type === 'Identifier'          &&
            node.expression.callee.object.name === 'jade_mixins'        ) {

          node.expression =  {
            "type": "CallExpression",
            "callee": {
                "type": "MemberExpression",
                "computed": false,
                "object": { "type": "Identifier",
                            "name": "buf" },
                "property": { "type": "Identifier",
                              "name": "push" } },
            "arguments": [node.expression]
          };

          return node;
        }
      }

      bufPush(node);

      if (node.body) node.body.body.map(bufPush);

      return node;

    }

module.exports = function transformJade (file) {

  var data = '';

  return through(write, end);

  function write (buf) { data += buf }

  function end   () {

    if (path.extname(file) === '.jade') {

      var ast    = esprima.parse(data)
        , mixins = [];

      for (var i = 0; i < ast.body.length; i++) {

        var node1 = ast.body[i];
        if (node1.type            === 'ExpressionStatement'  &&
            node1.expression.type === 'AssignmentExpression' &&
            node1.expression.left                            &&
            node1.expression.left.object.name   === 'module' &&
            node1.expression.left.property.name === 'exports') {

          var funcBody = node1.expression.right.body;
          for (var j = 0; j < funcBody.body.length; j++) {

            var node2 = funcBody.body[j];

            if (node2.type === 'VariableDeclaration') {
              for (var k = 0; k < node2.declarations.length; k++) {

                var node3 = node2.declarations[k];
                if (node3.type === 'VariableDeclarator' &&
                    node3.id.name === 'jade_mixins') {
                  node3 = JADE_MIXINS_DECLARATOR;
                }
              }
            }

            if (node2.type === 'ExpressionStatement' &&
                node2.expression.type === 'AssignmentExpression' &&
                node2.expression.left.object.name === 'jade_mixins') {
              mixins.push(node2);
              funcBody.body[j] = { type: "EmptyStatement" };
            }

          }

          break;
        }

      };

      mixins.map(function(mixin){

        var mixinBody = mixin.expression.right.body.body;

        // export each mixin
        mixin.expression.left.object = MODULE_EXPORTS;

        // declare local buf
        mixinBody.unshift(
          { type: "VariableDeclaration"
          , kind: "var"
          , declarations:
            [ { type: "VariableDeclarator"
              , id:   { type: "Identifier", name: "buf" }
              , init: { type: "ArrayExpression", elements: [] } }
            , JADE_MIXINS_DECLARATOR ] } );

        // push mixin calls to buf
        mixinBody.map(BUF_PUSH);

        // return buf
        mixinBody.push(
          { type: "ReturnStatement"
          , argument: { type: "CallExpression"
                      , callee: { type:     "MemberExpression"
                                , computed: false
                                , object:   { type: "Identifier", name: "buf"  }
                                , property: { type: "Identifier", name: "join" }}
                      , arguments:
                        [ { type: "Literal", value: "", raw: "\"\""   }]}});
        ast.body.push(mixin);

      })

      data = escodegen.generate(ast);

      //console.log('\n');
      //console.log(data);

    }

    this.queue(data);
    this.queue(null);
  }
}
